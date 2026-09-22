const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();
const { JSDOM } = require('jsdom');

const {
  Document: DocxDocument,
  Packer: DocxPacker,
  Paragraph: DocxParagraph,
  TextRun: DocxTextRun,
  HeadingLevel: DocxHeadingLevel
} = require('docx');

const DB_FILE = path.join(__dirname, 'db.json');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

if (!process.env.JWT_SECRET) {
  console.warn(
    'WARNING: using fallback JWT_SECRET; set JWT_SECRET in production environment'
  );
}

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: [], resumes: [] };
  }
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Failed to save DB', e);
  }
}

const app = express();

/*
 * Serve frontend files from the public folder.
 * This allows Azure App Service to serve index.html,
 * app.js and styles.css.
 */
app.use(express.static(path.join(__dirname, '../public')));

app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200
});

app.use(globalLimiter);

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many auth attempts, please try again later.'
});

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';

  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing token'
    });
  }

  const token = auth.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
}

// Helper: return validation errors
function sendValidationErrors(req, res) {
  const errs = validationResult(req);

  if (!errs.isEmpty()) {
    return res.status(400).json({
      errors: errs.array().map(e => ({
        param: e.param,
        msg: e.msg
      }))
    });
  }

  return null;
}

// Registration
app.post(
  '/api/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Invalid email')
      .normalizeEmail(),

    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),

    body('name')
      .optional()
      .trim()
      .escape()
  ],
  (req, res) => {
    if (sendValidationErrors(req, res)) return;

    const { name, email, password } = req.body || {};

    const db = loadDb();

    const normalizedEmail = (email || '').toLowerCase();

    if (db.users.find(u => u.email === normalizedEmail)) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const id = 'u_' + Date.now();

    const hash = bcrypt.hashSync(password, 10);

    const user = {
      id,
      name: name || '',
      email: normalizedEmail,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      failedAttempts: 0,
      lockUntil: null
    };

    db.users.push(user);
    saveDb(db);

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  }
);

// Login
app.post(
  '/api/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Invalid email')
      .normalizeEmail(),

    body('password')
      .exists()
      .withMessage('Password required')
  ],
  (req, res) => {
    if (sendValidationErrors(req, res)) return;

    const { email, password } = req.body || {};

    const db = loadDb();

    const normalizedEmail = (email || '').toLowerCase();

    const user = db.users.find(
      u => u.email === normalizedEmail
    );

    if (!user) {
      return res.status(400).json({
        error: 'Invalid credentials'
      });
    }

    // Check lockout
    if (
      user.lockUntil &&
      Date.now() < user.lockUntil
    ) {
      const remaining = Math.ceil(
        (user.lockUntil - Date.now()) / 1000
      );

      return res.status(423).json({
        error: `Account locked. Try again in ${remaining} seconds`
      });
    }

    if (!bcrypt.compareSync(password, user.passwordHash)) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;

      if (user.failedAttempts >= 5) {
        user.lockUntil =
          Date.now() + 15 * 60 * 1000;

        user.failedAttempts = 0;
      }

      saveDb(db);

      return res.status(400).json({
        error: 'Invalid credentials'
      });
    }

    // Successful login: reset counters
    user.failedAttempts = 0;
    user.lockUntil = null;

    saveDb(db);

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  }
);

// Get current user info
app.get('/api/me', authMiddleware, (req, res) => {
  const db = loadDb();

  const user = db.users.find(
    u =>
      u.id === req.user.id ||
      u.email === req.user.email
  );

  if (!user) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email
  });
});

// Server-side DOCX export
app.post(
  '/api/export/docx',
  express.json({ limit: '1mb' }),
  async (req, res) => {
    try {
      const { html, filename } = req.body || {};

      if (!html) {
        return res.status(400).json({
          error: 'Missing html in request body'
        });
      }

      // Parse HTML with jsdom
      const dom = new JSDOM(html);
      const bodyEl = dom.window.document.body;

      // Helper to extract inline runs
      function inlineRunsFromNode(node) {
        const runs = [];

        function collect(n) {
          if (
            n.nodeType ===
            dom.window.Node.TEXT_NODE
          ) {
            const txt = n.textContent.replace(
              /\s+/g,
              ' '
            );

            if (txt.trim()) {
              runs.push(
                new DocxTextRun({
                  text: txt
                })
              );
            }
          } else if (
            n.nodeType ===
            dom.window.Node.ELEMENT_NODE
          ) {
            const tag = n.tagName.toLowerCase();

            if (tag === 'strong' || tag === 'b') {
              runs.push(
                new DocxTextRun({
                  text: n.textContent,
                  bold: true
                })
              );
            } else if (
              tag === 'em' ||
              tag === 'i'
            ) {
              runs.push(
                new DocxTextRun({
                  text: n.textContent,
                  italics: true
                })
              );
            } else if (tag === 'br') {
              runs.push(
                new DocxTextRun({
                  text: '\n'
                })
              );
            } else {
              n.childNodes.forEach(c => collect(c));
            }
          }
        }

        node.childNodes.forEach(c => collect(c));

        return runs;
      }

      const paragraphs = [];

      function walk(node) {
        node.childNodes.forEach(n => {
          if (
            n.nodeType ===
            dom.window.Node.TEXT_NODE
          ) {
            const txt = n.textContent.trim();

            if (txt) {
              paragraphs.push(
                new DocxParagraph({
                  children: [
                    new DocxTextRun({
                      text: txt
                    })
                  ]
                })
              );
            }
          } else if (
            n.nodeType ===
            dom.window.Node.ELEMENT_NODE
          ) {
            const tag = n.tagName.toLowerCase();

            if (
              tag === 'h1' ||
              (
                n.classList &&
                n.classList.contains &&
                n.classList.contains('name')
              )
            ) {
              paragraphs.push(
                new DocxParagraph({
                  text: n.textContent.trim(),
                  heading:
                    DocxHeadingLevel.HEADING_1
                })
              );
            } else if (tag === 'h2') {
              paragraphs.push(
                new DocxParagraph({
                  text: n.textContent.trim(),
                  heading:
                    DocxHeadingLevel.HEADING_2
                })
              );
            } else if (
              tag === 'p' ||
              tag === 'div' ||
              tag === 'section' ||
              tag === 'span'
            ) {
              const runs = inlineRunsFromNode(n);

              if (runs.length === 0) {
                paragraphs.push(
                  new DocxParagraph('')
                );
              } else {
                paragraphs.push(
                  new DocxParagraph({
                    children: runs
                  })
                );
              }
            } else if (
              tag === 'ul' ||
              tag === 'ol'
            ) {
              const listItems =
                n.querySelectorAll('li');

              listItems.forEach(li => {
                const runs =
                  inlineRunsFromNode(li);

                paragraphs.push(
                  new DocxParagraph({
                    children: runs,
                    bullet: {
                      level: 0
                    }
                  })
                );
              });
            } else {
              walk(n);
            }
          }
        });
      }

      walk(bodyEl);

      const doc = new DocxDocument();

      doc.addSection({
        children: paragraphs
      });

      const buffer =
        await DocxPacker.toBuffer(doc);

      const outName =
        (filename || 'resume') + '.docx';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="' +
          outName +
          '"'
      );

      return res.send(buffer);
    } catch (err) {
      console.error(
        'DOCX export failed',
        err
      );

      return res.status(500).json({
        error: 'DOCX export failed',
        details: err.message
      });
    }
  }
);

// Create resume
app.post(
  '/api/resumes',
  authMiddleware,
  (req, res) => {
    const db = loadDb();

    const {
      data,
      template,
      name
    } = req.body || {};

    const id = 'r_' + Date.now();

    const rec = {
      id,
      userId: req.user.id,
      name:
        name ||
        'Resume ' +
          new Date().toISOString(),
      data,
      template,
      createdAt:
        new Date().toISOString()
    };

    db.resumes.push(rec);
    saveDb(db);

    res.json(rec);
  }
);

// Get resumes
app.get(
  '/api/resumes',
  authMiddleware,
  (req, res) => {
    const db = loadDb();

    const list = db.resumes.filter(
      r => r.userId === req.user.id
    );

    res.json(list);
  }
);

// Delete resume
app.delete(
  '/api/resumes/:id',
  authMiddleware,
  (req, res) => {
    const db = loadDb();

    const idx = db.resumes.findIndex(
      r =>
        r.id === req.params.id &&
        r.userId === req.user.id
    );

    if (idx === -1) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    db.resumes.splice(idx, 1);

    saveDb(db);

    res.json({
      ok: true
    });
  }
);

// Azure App Service compatible port
const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(
    'Backend listening on',
    port
  );
});