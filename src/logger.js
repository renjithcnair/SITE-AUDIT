const LEVEL_WEIGHTS = {
  DEBUG: 10,
  INFO: 20,
  ERROR: 30,
  FATAL: 40
};

function normalizeLevel(level) {
  const value = String(level || '').trim().toUpperCase();
  return LEVEL_WEIGHTS[value] ? value : 'INFO';
}

function currentMinLevel() {
  return normalizeLevel(process.env.LOG_LEVEL || 'INFO');
}

function shouldLog(level) {
  const normalized = normalizeLevel(level);
  return LEVEL_WEIGHTS[normalized] >= LEVEL_WEIGHTS[currentMinLevel()];
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(meta));
  } catch {
    return { metaSerializationError: true };
  }
}

function write(level, scope, message, meta) {
  if (!shouldLog(level)) return;

  const normalized = normalizeLevel(level);
  const payload = {
    at: new Date().toISOString(),
    level: normalized,
    scope,
    message,
    ...sanitizeMeta(meta)
  };
  const line = JSON.stringify(payload);

  if (normalized === 'ERROR' || normalized === 'FATAL') {
    console.error(line);
    return;
  }
  console.log(line);
}

function createLogger(scope) {
  const normalizedScope = scope || 'app';
  return {
    debug(message, meta) {
      write('DEBUG', normalizedScope, message, meta);
    },
    info(message, meta) {
      write('INFO', normalizedScope, message, meta);
    },
    error(message, meta) {
      write('ERROR', normalizedScope, message, meta);
    },
    fatal(message, meta) {
      write('FATAL', normalizedScope, message, meta);
    }
  };
}

module.exports = {
  createLogger,
  normalizeLevel,
  shouldLog
};
