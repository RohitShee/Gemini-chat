import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../frontend/pages/login.html')));
app.get('/chat', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    res.sendFile(path.resolve(__dirname, '../frontend/pages/chat.html'));
});

// Auth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/chat')
);

app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ displayName: "Guest" });
    }
    res.json({ displayName: req.user.displayName });
});

// Gemini API endpoint
app.post('/api/chat', express.json(), async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send();
  
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const { message } = req.body;
  
  res.setHeader('Content-Type', 'text/plain');
  const result = await model.generateContentStream(message);
  
  for await (const chunk of result.stream) {
    res.write(chunk.text());
  }
  res.end();
});

// Static files
app.use(express.static('public'));
app.listen(3000, () => console.log('Server running on port 3000'));
