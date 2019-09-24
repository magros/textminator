const {exec} = require('child-process-promise');
// const rp = require('request-promise');
const fs = require('fs');
const VisualRecognitionV3 = require('ibm-watson/visual-recognition/v3');
const AWS = require('aws-sdk');
const PDFParser = require('pdf2json');
const pdfParser = new PDFParser();
require('dotenv').config();

class TextExtractor {

    static clearText(text) {
        text = text.replace(/\n+/g, '\n').replace(/[ ]+/g, ' ').replace(/,/g, ' , ')
        return text.replace(/[^a-zA-Záéíñóúü0-9_\-\/ \t\n#\+ÁÉÍÓÚÜÑ,\.:;@%&\(\)\{\}\[\]àèùÀÈÙ\"“”!ﬁ]/igm, " ");
    }

    static async catDoc(path) {
        let command = `catdoc -dutf-8 ${path}`;
        let res = await exec(command);
        return this.clearText(res.stdout);
    }

    static async pdfToText(path) {
        let command = `pdftotext -enc "UTF-8" ${path}`;
        await exec(command);
        let res = await exec(`cat ${path}.txt`);
        return this.clearText(res.stdout);
    }

    static async docx2Txt(path) {
        let command = `docx2txt ${path}`;
        await exec(command);
        let res = await exec(`cat ${path}.txt`);
        return this.clearText(res.stdout);
    }

    static async pdfToPpm(path) {
        let command = `pdftoppm -jpeg -singlefile ${path} ${path}`;
        await exec(command);
    }

    static async odt2Txt(path) {
        let command = `odt2txt --encoding="UTF-8" ${path} `;
        let res = await exec(command);
        return this.clearText(res.stdout);
    }

    static async pdfMiner(path) {
        let command = `pdf2txt.py ${path} `;
        let res = await exec(command);
        return this.clearText(res.stdout);
    }

    static async classify(path) {

        await this.pdfToPpm(path);

        let visualRecognition = new VisualRecognitionV3({
            url: 'https://gateway.watsonplatform.net/visual-recognition/api',
            version: '2018-03-19',
            iam_apikey: process.env.WATSON_API_KEY,
        });

        let params = {
            images_file: fs.createReadStream(`${path}.jpg`),
            classifier_ids: [process.env.WATSON_CLASSIFIER_ID],
            threshold: '0.0'
        };

        let res = await visualRecognition.classify(params);

        let classes = res.images[0].classifiers[0].classes;

        let oneColumn = classes.find((obj) => obj.class === "onecolumn");
        let multipleColumns = classes.find((obj) => obj.class === "multiplecolumns");

        if (multipleColumns.score > oneColumn.score) {
            return "multiplecolumns";
        }
        return "onecolumn";
    }

    static async textract(path) {

        let bytes = fs.readFileSync(`${path}`, 'base64');
        const buffer = new Buffer(bytes, 'base64');

        let textract = new AWS.Textract({
            region: "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        let params = {
            Document: {
                Bytes: buffer
            },
            FeatureTypes: [
                "TABLES",
                "FORMS"
            ],
        };

        console.log('sending params');

        let res = await new Promise(function (resolve, reject) {

            textract.analyzeDocument(params, (err, data) => {
                err ? reject(err) : resolve(data);
            });

        });
        console.log(res);
        let lines = res.Blocks.filter(block => block.BlockType === 'LINE');
        let textArray = lines.map(line => line.Text);
        return this.clearText(textArray.join(' '));
    }

    static async getPDFPageCount(path) {
        return new Promise((resolve, reject) => {
            pdfParser.on('pdfParser_dataReady', function (data) {
                const pages = (pdfParser.PDFJS && pdfParser.PDFJS.pdfDocument && pdfParser.PDFJS.pdfDocument.numPages) || data.formImage.Pages.length;
                return resolve(pages);
            });
            pdfParser.on("pdfParser_dataError", err => {
                return reject(err);
            });
            pdfParser.loadPDF(path);
        });
    }

    static cleanText(text) {

        const r2 = /^[\w@ñÑáéíóúÁÉÍÓÚ]\n/igm
        let newToken = 0;
        let response = '';
        let match;

        console.log(text);

        while ((match = r2.exec(text))) {
            response += text.substring(newToken, match.index) + match[0].replace('\n', '');
            newToken = r2.lastIndex
        }
        response += text.substring(newToken, text.length - 1 );
        if (response.length === 0) {
            return text.replace(/[ ]+/g, ' ').replace(/,/g, ' , ');
        }
        response = response.replace(/\n+/g, ' ').replace(/[ ]+/g, ' ').replace(/,/g, ' , ')
        return response
    }

}

module.exports = TextExtractor;
