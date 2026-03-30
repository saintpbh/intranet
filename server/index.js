const express = require('express');
const cors = require('cors');
const sql = require('mssql');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false, // For local dev / non-azure
        trustServerCertificate: true,
        cryptoCredentialsDetails: {
            minVersion: 'TLSv1'
        }
    }
};

let poolPromise = sql.connect(dbConfig)
    .then(pool => {
        console.log('Connected to MS SQL Server');
        pool.on('error', err => {
            console.error('SQL Pool Error:', err);
        });
        return pool;
    })
    .catch(err => {
        console.error('Database connection failed:', err);
        process.exit(1);
    });

// --- API Endpoints ---

// 1. Get Churches
app.get('/api/churches', async (req, res) => {
    try {
        const pool = await poolPromise;
        const search = req.query.search || '';
        
        const result = await pool.request()
            .input('search', sql.NVarChar, `%${search}%`)
            .query(`
                SELECT TOP 100 
                    c.ChrCode, c.ChrName, n.NohName, s.SichalName, 
                    c.Tel_Church, c.Tel_Mobile, c.Tel_Fax, c.Juso, c.PostNo, c.Email 
                FROM TB_Chr100 c 
                LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode 
                LEFT JOIN TB_Chr920 s ON c.NohCode = s.NohCode AND c.SichalCode = s.SichalCode
                WHERE c.ChrName LIKE @search OR n.NohName LIKE @search
                ORDER BY n.NohName, c.ChrName
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 2. Get Ministers
app.get('/api/ministers', async (req, res) => {
    try {
        const pool = await poolPromise;
        const search = req.query.search || '';
        
        const result = await pool.request()
            .input('search', sql.NVarChar, `%${search}%`)
            .query(`
                SELECT TOP 100 
                    m.MinisterCode, m.MinisterName, m.CHRNAME, m.NOHNAME, m.DUTYNAME, 
                    m.TEL_MOBILE, m.TEL_CHURCH, m.JUSO 
                FROM VI_MINISTER_INFO m
                WHERE m.MinisterName LIKE @search OR m.CHRNAME LIKE @search OR m.NOHNAME LIKE @search
                ORDER BY m.NOHNAME, m.CHRNAME, m.MinisterName
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 3. Get Combined Address Book (Ministers + Elders)
app.get('/api/addressbook', async (req, res) => {
    try {
        const pool = await poolPromise;
        const search = req.query.search || '';
        
        const result = await pool.request()
            .input('search', sql.NVarChar, `%${search}%`)
            .query(`
                SELECT TOP 200 
                    MINISTERCODE, MINISTERNAME, NOHNAME, CHRNAME, 
                    TEL_CHURCH, TEL_MOBILE, POSTNO, ADDRESS, JUSO, EMAIL
                FROM VI_MIN_JANG_LIST_2
                WHERE MINISTERNAME LIKE @search OR CHRNAME LIKE @search OR NOHNAME LIKE @search
                ORDER BY NOHNAME, CHRNAME, MINISTERNAME
            `);
            
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// Start Server
app.listen(port, '0.0.0.0', () => {
    console.log(`Backend API running on http://localhost:${port}`);
});
