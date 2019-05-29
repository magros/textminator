const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({dest: 'uploads/'});
const textExtractor = require('./TextExtractor');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function (req, res) {
    res.send('Hello World!');
});

app.post('/extract-text', upload.single('file'), async function (req, res) {
    console.log('request received');
    try {
        let file = req.file;
        if(!file) throw new Error("File must be provided");
        console.log(file);
        let path = req.file.path;
        let tool;
        let mimeType = file.mimetype;
        let text;
        let typePdf;

        switch (mimeType) {
            case "application/pdf":
                typePdf = await textExtractor.classify(path);
                tool = typePdf === "onecolumn" ? "pdftotext" : "pdfminer";
                text = tool === "pdftotext" ? await textExtractor.pdfToText(path) : await textExtractor.pdfMiner(path);
                if(text.replace("\n").replace("\t").length < 5){
                    await textExtractor.pdfToPpm(path);
                    text = await textExtractor.textract(path+".jpg");
                    tool = "textract";
                }
                break;
            case "application/msword":
                tool = "catdoc";
                text = await textExtractor.catDoc(path);
                break;
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                text = await textExtractor.docx2Txt(path);
                tool = "docx2txt";
                break;
            case "application/vnd.oasis.opendocument.text":
                text = await textExtractor.odt2Txt(path);
                tool = "odt2txt";
                break;
            case "image/png":
            case "image/jpeg":
                text = await textExtractor.textract(path);
                tool = "textract";
                break;
            default:
                throw new Error(`Cannot find tool for ${mimeType}`);
        }
        res.send({
            text,
            status: "success",
            mimeType,
            typePdf,
            tool
        });
    } catch (e) {
        console.log(e);
        res.send({
            message: e.message,
            status: "error"
        });

    }
});
// app.post('/textract')
app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});