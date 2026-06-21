"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("Articles");

    if (!columns.userId) {
      await queryInterface.addColumn("Articles", "userId", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("Articles");

    if (columns.userId) {
      await queryInterface.removeColumn("Articles", "userId");
    }
  },
};