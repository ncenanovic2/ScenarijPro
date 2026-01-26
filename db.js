// db.js
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('wt26', 'root', 'password', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false 
});

const Scenario = sequelize.define('Scenario', {
    title: { type: DataTypes.STRING, allowNull: false }
});

const Line = sequelize.define('Line', {
    lineId: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT },
    nextLineId: { type: DataTypes.INTEGER }
});

Scenario.hasMany(Line, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Line.belongsTo(Scenario, { foreignKey: 'scenarioId' });


const Delta = sequelize.define('Delta', {
    type: DataTypes.STRING,
    lineId: DataTypes.INTEGER,
    nextLineId: DataTypes.INTEGER,
    content: DataTypes.TEXT,
    oldName: DataTypes.STRING,
    newName: DataTypes.STRING,
    timestamp: DataTypes.INTEGER
});
Scenario.hasMany(Delta, { foreignKey: 'scenarioId' });

const Checkpoint = sequelize.define('Checkpoint', {
    timestamp: DataTypes.INTEGER
});
Scenario.hasMany(Checkpoint, { foreignKey: 'scenarioId' });

module.exports = { sequelize, Scenario, Line, Delta, Checkpoint };