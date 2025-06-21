import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { handleAnalyseCommand, handleInteractiveAction } from "./slack-interactive";

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register Slack endpoints FIRST to prevent Vite catch-all from intercepting
app.post('/slack/commands', async (req, res) => {
  const body = req.body;
  console.log('Received Slack command:', body.command, 'from user:', body.user_id);

  if (body.command === 'ok /analyse') {
    try {
      const modalPromise = handleAnalyseCommand(body);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 1500);
      });
      
      await Promise.race([modalPromise, timeoutPromise]);
      res.status(200).json({ text: '' });
      
    } catch (error) {
      console.error('Modal failed, sending fallback:', error);
      res.status(200).json({
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Analytics Assistant*\n\nAsk me any analytics question:'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Quick Questions:*\n• What are our conversion rates?\n• How is user engagement trending?\n• What drives revenue growth?\n• Which cohorts show best retention?'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Just mention @Analytics Assistant with your question'
              }
            ]
          }
        ]
      });
    }
  } else {
    res.status(200).json({
      response_type: 'ephemeral',
      text: 'Command not recognized. Use /analyse to ask analytics questions.'
    });
  }
});

app.post('/slack/interactions', async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    console.log('Received Slack interaction:', payload.type, 'from user:', payload.user?.id);
    
    await handleInteractiveAction(payload);
    res.status(200).json({ text: '' });
  } catch (error) {
    console.error('Interaction error:', error);
    res.status(200).json({ text: '' });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 3000;
  
  const startServer = () => {
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
    });
  };

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is busy, waiting for it to be available...`);
      setTimeout(() => {
        startServer();
      }, 3000);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
  
  startServer();
})();
