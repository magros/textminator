const rp = require('request-promise')
const {exec} = require('child-process-promise')
const fs = require('fs')

const getEntities = async file => rp({
    method: 'POST',
    uri: 'http://cv-detection-lb-986057020.us-west-2.elb.amazonaws.com/queryimg',
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
    let pages = await exec(`ls uploads | grep -E ${fileName}.*jpg | wc -l`)
    pages = pages.stdout
    let promises = []

    for (let i = 1; i <= pages; i++) {
        console.log(`${path}-${i}.jpg`)
        promises.push(new Promise((resolve, reject) => {
            console.log('requesting entities ')
            getEntities(`${path}-${i}.jpg`).then(function (response) {
                console.log(response)
                resolve(JSON.parse(response))
            }).catch(() => reject)
        }))
    }

    return await Promise.all(promises);
}