// db.js
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('wt26', 'root', 'password', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false 
});

const Scenario = sequelize.define('Scenario', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    title: { 
        type: DataTypes.STRING, 
        allowNull: false 
    }
});

const Line = sequelize.define('Line', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    lineId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    text: { 
        type: DataTypes.TEXT 
    },
    nextLineId: { 
        type: DataTypes.INTEGER,
        allowNull: true 
    }
});

// Relacija Scenario - Line
Scenario.hasMany(Line, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Line.belongsTo(Scenario, { foreignKey: 'scenarioId' });

const Delta = sequelize.define('Delta', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    type: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    lineId: { 
        type: DataTypes.INTEGER 
    },
    nextLineId: { 
        type: DataTypes.INTEGER 
    },
    content: { 
        type: DataTypes.TEXT 
    },
    oldName: { 
        type: DataTypes.STRING 
    },
    newName: { 
        type: DataTypes.STRING 
    },
    timestamp: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    }
});

// Relacija Scenario - Delta
Scenario.hasMany(Delta, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Delta.belongsTo(Scenario, { foreignKey: 'scenarioId' });

const Checkpoint = sequelize.define('Checkpoint', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    timestamp: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    }
});

// Relacija Scenario - Checkpoint
Scenario.hasMany(Checkpoint, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Checkpoint.belongsTo(Scenario, { foreignKey: 'scenarioId' });

module.exports = { sequelize, Scenario, Line, Delta, Checkpoint };