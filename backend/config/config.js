const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

/**
 * Creates a local SQLite configuration.
 *
 * Each environment receives a different database file so test data
 * does not affect development data.
 */
function createSqliteConfig(filename) {
  return {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, `../database/${filename}`),
    logging: false,
  };
}

/** @type {import('sequelize').Options} */
module.exports = {
  development: createSqliteConfig('conduit-development.sqlite'),
  test: createSqliteConfig('conduit-test.sqlite'),
  production: createSqliteConfig('conduit-production.sqlite'),
};