// src/lib/appInfo.js
import pkg from "../../package.json";

export const APP_NAME = "Bineytna App";          // or: pkg.displayName || pkg.name
export const APP_VERSION = pkg.version || "0.0.0";
