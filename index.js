var moveFrom = "docs";
const path = require("path");
const fs   = require("fs");
const lineByLine = require('n-readlines');
let Files  = [];
const fetch =  require('node-fetch')
const { execSync } = require("child_process");
const FormData = require('form-data');


const HOST = 'https://11b4-49-37-246-129.in.ngrok.io/'
let REPO_NAME = process.env.GITHUB_REPOSITORY
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER
const SHA = process.env.GITHUB_SHA
let docId = ""

const AVAILABLE_WIDGET_TYPES = {
    "image": {targetFunction: getImageHtml},
    "maths": {targetFunction: getMathsHtml},
    "worksheet": {targetFunction: getWorksheetHtml},
    "abstraction": {}
}

function getImageHtml(_artefact) {
    if (!_artefact.data) {
        return ``
    }
    return `<img src="${_artefact.data.annotatedImage}" alt="Red dot" />`
}

function getMathsHtml(_artefact) {
    if (!_artefact.data) {
        return ``
    }
    return `$$ ${_artefact.data} $$`
}

function getWorksheetHtml(_artefact) {
    if (!_artefact.data) {
        return ``
    }
    return `<worksheet-viewer data-uid="${_artefact.uid}">
			${JSON.stringify(_artefact)}
		</worksheet-viewer>`
}

function reverseSortArtifactsBasedOnCursorPos(artifacts) {
    return artifacts.sort((a, b) => b.jsonData[0].cursor.line - a.jsonData[0].cursor.line);
}

function ThroughDirectory(Directory) {
    fs.readdirSync(Directory).forEach(File => {
        const Absolute = path.join(Directory, File);
        if (fs.statSync(Absolute).isDirectory()) return ThroughDirectory(Absolute);
        else return Files.push(Absolute);
    });
}

async function FetchFromServer(_url, requestOptions) {
    console.log("Making Request ", _url)
    try {
        var _fetch = await fetch(_url, requestOptions)
    } catch (e) {
        console.log("Fetch", e);
        throw e;
    }
    try {
        var response = await _fetch.json();
    } catch (e) {
        console.log("Fetch", e);
        throw e;
    }

    if (_fetch.status === 200 || _fetch.status === 201) {
        return response
    }
    throw response;
}

async function getDocId(repo_name) {
    try {
        let url = `${HOST}docs/repo/${repo_name}`;
        var requestOptions = {
            method: 'GET',
            redirect: 'follow'
        };
        var response = await FetchFromServer(url, requestOptions);
    } catch (e) {
        throw e;
    }

    return response.id;
}

async function checkIfFileHasArtifact(fileName, docId) {
    fileName = fileName.split("../").join("");
    var _filePathBase64 = Buffer.from(fileName).toString('base64')
    var requestOptions = {
        method: 'GET',
        redirect: 'follow',
        credentials: 'include'
    };
    let _artifactUrl = `${HOST}docs/${docId}/file/${_filePathBase64}/artifact`;
    try {
        var result = await FetchFromServer(_artifactUrl, requestOptions);
    } catch (e) {
        throw e;
    }
    if (result.length > 0) {
        return result;
    } else {
        throw result;
    }
}

async function ReadFileAndWriteArtifacts() {
    for (var filePath of Files) {
        try {
            var artifacts = await checkIfFileHasArtifact(filePath, docId)
        } catch (e) {
            continue;
        }
        const liner = new lineByLine(filePath);
        let line;
        let lineNumber = 0;
        console.log(`${filePath} has ${artifacts.length} artifacts`)
        let fileData = []
        while (line = liner.next()) {
            fileData[lineNumber] = line.toString('ascii');
            lineNumber++;
        }
        console.log(`${filePath} has ${fileData.length} lines before writing artifacts`)
        artifacts = reverseSortArtifactsBasedOnCursorPos(artifacts)
        for (var artifact of artifacts) {
            var data = artifact.jsonData[0];
            var cursor = data.cursor;
            var cType = data.config.cType;
            var getCtype = AVAILABLE_WIDGET_TYPES[cType];
            var widgetLineNumber = cursor.line;
            var html = getCtype.targetFunction.call(this, data);
            fileData.splice(widgetLineNumber, 0, html);
        }
        console.log(`${filePath} has ${fileData.length} lines after writing artifacts`)
        var logger = fs.createWriteStream(`${filePath}`)
        for (var _fileData of fileData) {
            logger.write(_fileData)
            logger.write("\n")
        }
        console.log(`Finished writing ${filePath}`);
    }
}

async function sendZipToServer(filePath) {
    console.log(`Sending zip to server ${filePath}`);
    const form = new FormData();
    form.append('buildZip', fs.createReadStream(filePath));
    const options = {
        method: 'POST',
        redirect: 'follow',
        body: form,
        headers: {...form.getHeaders(), maxContentLength: Infinity}
    };

    try {
        var _uploadUrl = `${HOST}upload-build`
        //console.log(_uploadUrl, options);
        var result = await FetchFromServer(_uploadUrl, options);
    } catch (e) {
        console.error(e);
        throw e;
    }
    console.log("File Uploaded ", result);
    return result;
}

// async function notifyBuildStarted() {
//     try {
//         var url = `${HOST}git/wiki_build_update`
//         var payload = {"repoName": `${REPO_OWNER}/${REPO_NAME}`, "targetSha": SHA}
//         var raw = JSON.stringify(payload);
//         var requestOptions = {
//             method: 'POST',
//             body: raw,
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             redirect: 'follow'
//         };
//         console.log(requestOptions);
//         var result = await FetchFromServer(url, requestOptions);
//     } catch (e) {
//         throw e;
//     }
//
//     return result;
// }


async function main() {
    try {
        console.time();
        console.log("Current directory:", __dirname);
        console.log("REPO_NAME ", REPO_NAME);
        console.log("REPO_OWNER ", REPO_OWNER);
        console.log("SHA ", SHA);
        if (!REPO_OWNER || !REPO_NAME || !SHA) {
            console.log("One or more environment variables undefined");
            process.exit(1);
        }
        //await notifyBuildStarted();
        REPO_NAME = REPO_NAME.split("/")[1]
        docId = await getDocId(REPO_NAME);
        console.log("documentId ", docId);
        ThroughDirectory(moveFrom);
        console.log(`Found Total ${Files.length}`);
        await ReadFileAndWriteArtifacts();
        var docsBuild = execSync('mkdocs build');
        console.log(docsBuild.toString());
        var zipName = `${REPO_NAME.trim()}.zip`
        var zipDir = execSync(`zip -r ${zipName} site/`)
        console.log(zipDir.toString());
        await sendZipToServer(`${zipName.trim()}`)
        console.timeEnd();
    } catch (e) {
        console.error(e);
        process.exit(1);
        throw e;
    }
}


main();