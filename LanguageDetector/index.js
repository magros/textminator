const fs = require("fs");
const path = require("path");

const splitter = new RegExp(' , |[\. \n]+|,|;|\t+|[\n ]+');

function loaddict() {
    let endict = fs.readFileSync(path.resolve(__dirname, "dict/korpusen"), 'utf8').split('\n')
    let esdict = fs.readFileSync(path.resolve(__dirname, "dict/korpuzes"), 'utf8').split('\n')
    return [endict, esdict]
}

function tokenizer(text) {
    return text.split(splitter);
}

module.exports = function (text) {

    let en = 0
    let es = 0

    let dicts = loaddict()

    const endict = dicts[0]
    const esdict = dicts[1]

    const tokens = tokenizer(text)
    const total = tokens.length

    tokens.forEach(
        function (value) {
            if (endict.includes(value.toLowerCase())) {
                en++
            }
            if (esdict.includes(value.toLowerCase())) {
                es++
            }
        }
    )

    return (en / total) >= (es / total) ? 'EN' : 'ES';
}

