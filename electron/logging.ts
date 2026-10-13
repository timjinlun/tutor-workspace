import { app } from "electron";
import log from "electron-log/main";
import path from "node:path";

// Resolve after setupUserData pins Electron's userData directory.
log.transports.file.resolvePathFn = () => path.join(app.getPath("userData"), "logs", "main.log");
log.transports.file.level = "info";
log.errorHandler.startCatching();
log.eventLogger.startLogging();

export const appLogger = log;
