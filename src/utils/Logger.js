const winston = require('winston');
const path = require('path');

class Logger {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'discord-bot' },
            transports: [
                new winston.transports.File({ 
                    filename: path.join(__dirname, '..', '..', 'logs', 'error.log'), 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: path.join(__dirname, '..', '..', 'logs', 'combined.log') 
                })
            ]
        });

        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }
}

module.exports = Logger;
