const {exec} = require('child-process-promise');
// const rp = require('request-promise');
const fs = require('fs');
const VisualRecognitionV3 = require('ibm-watson/visual-recognition/v3');
const {IamAuthenticator} = require('ibm-watson/auth');
const AWS = require('aws-sdk');
const PDFParser = require('pdf2json');
const pdfParser = new PDFParser();
require('dotenv').config();
const XRegExp = require('xregexp');
const path = require('path');
const rp = require('request-promise')

class TextExtractor {

    static clearText(text) {
        const date = XRegExp(`[\u0301]`, 'x');
        const dateI = XRegExp(`[\u0131]`, 'x');

        text = this.deleteExtraSpaces(text);
        text = text.replace(/\n+/g, '\n').replace(/[ ]+/g, ' ').replace(/,/g, ' , ')
        text = XRegExp.replace(text, date, '');
        text = XRegExp.replace(text, dateI, 'í');
        text = text.replace(/[^a-zA-Záéíı́ñóú́'ü0-9_\w\-\/\t\n#\+ÁÉÍÓÚÜÑ,\.:;@%&\(\)\{\}\[\]àèùÀÈÙ\"“”!ﬁ]/gm, " ");
        return text;
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
        let command = `python /usr/local/bin/pdf2txt.py ${path} `;
        let res = await exec(command);
        return this.clearText(res.stdout);
    }

    static async classify(path) {

        await this.pdfToPpm(path);

        const fileEncoded = fs.readFileSync(`${path}.jpg`, {encoding: 'base64'})
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

        let documentKind = {responses: 1}

        try {
            documentKind = await rp({
                method: 'POST',
                uri: "https://6kzgzk8nwe.execute-api.us-west-2.amazonaws.com/dev/columnclassifier",
                body: {"b64": [fileEncoded]},
                json: true
            })
        } catch (e) {}

        if (documentKind.responses) {
            return "multiplecolumns";
        }
        return "onecolumn";
    }

    static async textract(path) {

        /* let bytes = fs.readFileSync(`${path}`, 'base64');
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
         return this.clearText(textArray.join(' '));*/
        return ''
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

        const r2 = /(^[\w@ñÑáéíóúÁÉÍÓÚ]\n)|(\n[\w@ñÑáéíóúÁÉÍÓÚ]\ )/gim
        let newToken = 0;
        let response = '';
        let match;

        while ((match = r2.exec(text))) {
            response += text.substring(newToken, match.index) + match[0].replace('\n', '');
            newToken = r2.lastIndex
        }
        response += text.substring(newToken, text.length - 1);
        if (response.length === 0) {
            return text.replace(/[ ]+/g, ' ').replace(/,/g, ' , ');
        }
        response = response.replace(/\n+/g, ' ').replace(/[ ]+/g, ' ').replace(/,/g, ' , ')
        return response
    }

    static deleteExtraSpaces(text) {
        let response = '';
        let tokenbyEOL = text.replace(/\(cid:\d+\)/igm, '').split('\n')
        tokenbyEOL.forEach(function (value) {
            let r2 = /\ [\w@ñÑáéíóúÁÉÍÓÚ]/igm
            let newToken = 0;
            let len = value.length;
            let spaceCount = (value.split(" ").length - 1);
            let metric = spaceCount / len + .00000000000000000000001;
            let match

            if (metric >= .27 && !isNaN(metric)) {
                while ((match = r2.exec(value))) {
                    response += value.substring(newToken, match.index) + match[0].replace(' ', '');
                    newToken = r2.lastIndex
                }
                // console.log('val'+(value.length-1)+' '+newToken+' eol');
                if ((value.length - 1) >= newToken) {
                    try {
                        response += value.substring(newToken, value.length);
                    } catch (e) {
                        console.log('un error tio');
                    }
                }
            } else {
                response += value
            }
            response += '\n'
        });
        return response.replace(/\n+/g, '\n').replace(/\ +/g, ' ');
    }

    static deleteFiles() {

        const directory = 'uploads';

        fs.readdir(directory, (err, files) => {
            if (err) throw err;

            for (const file of files) {
                fs.unlink(path.join(directory, file), err => {
                    if (err) throw err;
                });
            }
        });
    }
}

module.exports = TextExtractor;
