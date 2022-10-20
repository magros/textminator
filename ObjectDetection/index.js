const rp = require('request-promise')
const {exec} = require('child-process-promise')
const fs = require('fs')
const classExp = 2
const classEdu = 4
const classSkill = 6
const classLang = 9
const classPersonalData = 0
const threshold = 0.40
require('dotenv').config();

const getEntities = async file => rp({
    method: 'POST',
    uri: getEndpoint(),
    formData: {
        file: {
            value: fs.createReadStream(file),
            options: {
                filename: 'file',
                contentType: 'image/jpg'
            }
        }
    },
})

const getEndpoint = () => {
    // const random = Math.floor(Math.random() * (10 - 1)) + 1
    //
    // if(random > 9){
    //     return process.env.OBJECT_DETECTION_URL;
    // }
    return 'https://39aphlu1wk.execute-api.us-west-2.amazonaws.com/dev/queryimg';
}

const buildXML = function (entities, classnumber) {
    return entities.filter(entity => entity.classnumber == classnumber && entity.prob >= threshold)
        .map((entity) => `\n\n<trennzeichen>\n\n ${entity.text} \n\n</trennzeichen>\n\n`)
        .join('\n')
}

const parser = function (entities) {
    console.log('parsing')

    let experiences = ''
    let educations = ''
    let skills = ''
    let languages = ''
    let personaldata = ''

    for (const box of entities) {
        entities = box.all
        experiences += buildXML(entities, classExp)
        educations += buildXML(entities, classEdu)
        skills += buildXML(entities, classSkill)
        languages += buildXML(entities, classLang)
        personaldata += buildXML(entities, classPersonalData)
    }
    return `<experiences>\n${experiences}\n</experiences>\n\n
            <educations>\n${educations}\n</educations>\n\n
            <skills>\n${skills}\n</skills>\n\n
            <personaldata>\n${personaldata}\n</personaldata>\n\n
            <languages>\n${languages}\n</languages>\n\n`;
}

module.exports = async (path, mimeType) => {
    console.log(mimeType)

    if (mimeType !== 'application/pdf') {
        console.log('converting')
        let command = `unoconv -f pdf ${path}`
        await exec(command)
        path = `${path}.pdf`
    }

    let command = `pdftoppm -r 300 -jpeg ${path} ${path}`
    await exec(command)
    const fileName = path.split('/')[1]
    let pages = await exec(`ls uploads | grep -E ${fileName}.*-.*jpg | wc -l`)
    pages = pages.stdout
    let promises = []

    for (let i = 1; i <= pages; i++) {

        promises.push(new Promise((resolve, reject) => {
            console.log(`requesting entities ${path}-${i}.jpg`)
            console.time(`image${i}`)
            getEntities(`${path}-${i}.jpg`).then(function (response) {
                console.timeEnd(`image${i}`)
                resolve(JSON.parse(response))
            }).catch(() => reject)
        }))
    }
    const response = await Promise.all(promises)
    return parser(response)
}