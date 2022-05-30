var moveFrom = "../";
const path = require("path");
const fs   = require("fs");
const lineByLine = require('n-readlines');
let Files  = [];
const fetch =  require('node-fetch')


const HOST = 'http://localhost:8879/'
const REPO_NAME = "kb_Gridbot_master_document_m4fl4"
const docId = "9686175d-6bdd-4c9c-b709-6fcde0d4852e"

const AVAILABLE_WIDGET_TYPES = {
    "image":{targetFunction: getImageHtml},
    "maths":{targetFunction: getMathsHtml},
    "worksheet":{targetFunction: getWorksheetHtml},
    "abstraction":{}
}

function getImageHtml(_artefact){
    if(!_artefact.data){
        return ``
    }
    return `<img src="${_artefact.data.annotatedImage}" alt="Red dot" />`
}

function getMathsHtml(_artefact) {
    if(!_artefact.data){
        return ``
    }
    return `<div>$$ ${_artefact.data} $$</div>`
}

function getWorksheetHtml(_artefact){
    if(!_artefact.data){
        return ``
    }
    return `<worksheet-viewer data-uid="${_artefact.uid}">
			${JSON.stringify(_artefact)}
		</worksheet-viewer>`
}

function reverseSortArtifactsBasedOnCursorPos(artifacts) {
    return artifacts.sort((a,b) => b.jsonData[0].cursor.line - a.jsonData[0].cursor.line);
}

function ThroughDirectory(Directory) {
    console.log("STARTED BUILD PROCESS", Directory);
    fs.readdirSync(Directory).forEach(File => {
        const Absolute = path.join(Directory, File);
        if (fs.statSync(Absolute).isDirectory()) return ThroughDirectory(Absolute);
        else return Files.push(Absolute);
    });
}

async function FetchFromServer(_url, requestOptions) {
    try {
        var _fetch = await fetch(_url, requestOptions)
    } catch (e) {
        throw e;
    }
    try{
        var response  =  await _fetch.json();
    }catch(e){
        throw e;
    }

    if(_fetch.status === 200){
        return response
    }
    throw response;
}

function getDocId(repo_name){
    try{
        let url = `${HOST}docs/${repo_name}`;
        var requestOptions = {
            method: 'GET',
            redirect: 'follow'
        };
        var response =  FetchFromServer(url, requestOptions);
    }catch (e) {
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
    console.log("artifact result ", result, fileName);
    if (result.length > 0) {
        return result;
    } else {
        throw result;
    }
}

async function ReadFile() {
    for (var filePath of Files) {
        try {
            var artifacts = await checkIfFileHasArtifact(filePath, docId)
        } catch (e) {
            continue;
        }
        const liner = new lineByLine(filePath);
        let line;
        let lineNumber = 0;
        console.log(filePath)
        let fileData = []
        while (line = liner.next()) {
            //console.log('Line ' + lineNumber + ': ' + line.toString('ascii'));
            fileData[lineNumber] = line.toString('ascii');
            lineNumber++;
        }
        artifacts  = reverseSortArtifactsBasedOnCursorPos(artifacts)
        var id = ""
        for(var artifact of artifacts){
            var data = artifact.jsonData[0];
            var cursor = data.cursor;
            var cType  =  data.config.cType;
            var getCtype  = AVAILABLE_WIDGET_TYPES[cType];
            var widgetLineNumber = cursor.line;
            id = artifact.id;
            var html = getCtype.targetFunction.call(this,data);
            fileData.splice(widgetLineNumber,0,html);
        }
        var logger = fs.createWriteStream(`log${id}.txt`)
        for(var _fileData of fileData){
            logger.write(_fileData)
            logger.write("\n")
        }
    }
}

ThroughDirectory(moveFrom);
console.log(Files)
ReadFile();