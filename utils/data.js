const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const initDataFile = (filename, initialData) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    }
};

const readData = (filename) => {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取${filename}失败:`, error);
        return [];
    }
};

const writeData = (filename, data) => {
    try {
        const filePath = path.join(DATA_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`写入${filename}失败:`, error);
        return false;
    }
};

// 初始化所有数据文件
const initAllData = () => {
    initDataFile('memories.json', []);
    initDataFile('photos.json', []);
    initDataFile('messages.json', []);
    initDataFile('admin.json', { password: '232323' });
    initDataFile('comments.json', []);
    initDataFile('daily-moods.json', []);
};

module.exports = { DATA_DIR, readData, writeData, initDataFile, initAllData };
