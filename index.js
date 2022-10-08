const fs = require("fs");
const lineByLine = require('n-readlines');
let Files = [];
const fetch = require('node-fetch')
const {execSync} = require("child_process");
const FormData = require('form-data');
const https = require("https");
const yaml = require('js-yaml');
const {mdToPdf} = require('md-to-pdf');
const path = require('path');
const {merge} = require('merge-pdf-buffers');

const BASE_CONFIG_URL = 'https://s3.ap-south-1.amazonaws.com/static.footloose.io/mkdocs-base-config/base.yml'
const HOST = 'https://docs.brahma.ai/'
let REPO_NAME = process.env.GITHUB_REPOSITORY
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER
const SHA = process.env.GITHUB_SHA
let docId = ""
const STRIP_PATH = "docs"

const PDF_PAGES_BUFFER = [];
var CHROME_PATH = process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/chromium';

const DEFAULT_ARTIFACT_PROCESSOR = {
    targetFunction: getHtml
}

const AVAILABLE_WIDGET_TYPES = {
    "image": {targetFunction: getImageHtml},
    "maths": {targetFunction: getMathsHtml},
    "worksheet": {targetFunction: getWorksheetHtml},
    "abstraction": {targetFunction: getAbstractionHtml},
    "html": {targetFunction: getHtml},
    "table": {targetFunction: getHtml},
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
    return `<div class="worksheet">${JSON.stringify(_artefact.data)}</div>`
}

function getAbstractionHtml(_artefact) {
    if (!_artefact.data) {
        return ``
    }
    return `<div class="abstraction">${_artefact.data.trim()}</div>`
}

function getHtml(_artefact) {
    if (!_artefact.data) {
        return ``
    }
    return `<div>${_artefact.data.trim()}</div>`
}

function reverseSortArtifactsBasedOnCursorPos(artifacts) {
    return artifacts.sort((a, b) => b.jsonData[0].cursor.line - a.jsonData[0].cursor.line);
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

async function getDocArtifacts(repo_name) {
    try {
        let url = `${HOST}docs/repo/${repo_name}/artifact`;
        var requestOptions = {
            method: 'GET',
            redirect: 'follow'
        };
        var response = await FetchFromServer(url, requestOptions);
    } catch (e) {
        throw e;
    }
    return response;
}

async function checkIfFileHasArtifact(fileName, docId) {
    var _filePathBase64 = fileName
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
        filePath = Buffer.from(filePath, 'base64').toString('ascii');
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
            var getCtype = AVAILABLE_WIDGET_TYPES[cType] || DEFAULT_ARTIFACT_PROCESSOR;
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

async function downloadBaseConfigYML() {
    return new Promise(async (resolve, reject) => {
        const file = fs.createWriteStream("base.yml");
        const request = await https.get(BASE_CONFIG_URL, function (response) {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                console.log("Download Completed");
                resolve();
            });
        });
    })
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getFileType(_fileName) {
    return _fileName.split(".").length > 1 ? "file" : "folder";
}

function normalizeNavIndex(_navIndex, normalizedNavIndex = [], _parent = {depth: 0}) { //_navIndex is a deep array of objs corresponding to structure of the doc
    _navIndex.forEach((_navPathObj, idx) => {
        Object.keys(_navPathObj).forEach((_navPathKey) => {
            let _navPathValue = _navPathObj[_navPathKey];
            // console.debug("DEBUG: normalizeNavIndex _slNo = ", idx, ", for _navPathKey = ", _navPathKey);
            if (Array.isArray(_navPathValue)) {
                let _folderPathValue = _parent.fullPath ? `${_parent.fullPath}/${_navPathKey}` : `${_navPathKey}`;
                let _depth = _folderPathValue.split("/").length;
                normalizedNavIndex.push({
                    name: _navPathKey,
                    type: "folder",
                    depth: _depth,
                    navPath: `${STRIP_PATH}/${_folderPathValue}`,
                    fullPath: `${STRIP_PATH}/${_folderPathValue}`,
                    parent: _parent.name,
                    value: _folderPathValue,
                    childCount: _navPathValue.length,
                    slNoWithinParent: idx
                });

                let _parentObj = {
                    name: _navPathKey,
                    fullPath: _folderPathValue,
                    depth: _depth
                }
                normalizeNavIndex.call(this, _navPathValue, normalizedNavIndex, _parentObj);
            } else {
                let _navPathList = _navPathValue.split("/");
                let _depth = _navPathList.length;

                if (!normalizedNavIndex.find((_navIndexEntry) => {
                    return _navIndexEntry.depth == _depth && _navIndexEntry.name == _navPathKey && _navIndexEntry.parent == _parent.name;
                })) {
                    let _folderPathValue = _parent.fullPath ? `${_parent.fullPath}/${_navPathKey}` : `${_navPathKey}`;
                    normalizedNavIndex.push({
                        name: _navPathKey,
                        type: getFileType(_navPathValue),
                        depth: _depth,
                        navPath: `${STRIP_PATH}/${_folderPathValue}`,
                        fullPath: `${STRIP_PATH}/${_navPathValue}`,
                        value: _navPathValue,
                        parent: _navPathList.length > 1 ? _navPathList.slice(-2, 1)[0] : null,
                        childCount: 1,
                        slNoWithinParent: idx
                    });
                }
            }
        });
    });
    return normalizedNavIndex;
}

function getDocumentNavigation(navFilePath) {
    try {
        let fileContents = fs.readFileSync(navFilePath, 'utf8');
        let JSON = yaml.load(fileContents);
        return JSON.nav;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function generatePdfFromMd(config) {
    // launch_options: { args: ['--no-sandbox'] } }
    console.log("Generating PDF from MD with new flags");
    try {
        const pdf = await mdToPdf(config, {
            launch_options: {
                executablePath: '/usr/bin/google-chrome-stable',
                args: [
                    "--no-sandbox",
                    '--disable-setuid-sandbox',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            }
        })
        if (pdf) {
            var pdfBuffer = pdf.content;
            PDF_PAGES_BUFFER.push(pdfBuffer);
        }else{
            console.error("PDF Generation Failed");
        }
    } catch (e) {
        console.error(e);
    }
}

async function generatePdfForDocument(normalizedNavIndex) {
    for (var _navIndexEntry of normalizedNavIndex) {
        if (_navIndexEntry.type === "file") {
            let _filePath = path.join(__dirname, _navIndexEntry.fullPath);
            await generatePdfFromMd({path: _filePath});
            // let _fileContents = fs.readFileSync(_filePath, 'utf8');
            // console.log(await parseToc(_fileContents))
        }
    }
    await mergePDF();
}

async function mergePDF() {
    const merged = await merge(PDF_PAGES_BUFFER);
    fs.writeFileSync('ebook.pdf', merged);
}

function createNavToc(navIndex) {
    var heading = "# Table of Contents";
    var toc = navIndex
        .map((t) => `${Array(t.depth).join("  ")}- [${t.name.trim()}](#${t.name.trim().split(" ").join("-")})`)
        .join("\n\n");
    return `${heading}\n\n${toc}`;
}

async function main() {
    try {
        console.time();
        // console.log("Current directory:", __dirname);
        // console.log("REPO_NAME ", REPO_NAME);
        // console.log("REPO_OWNER ", REPO_OWNER);
        // console.log("SHA ", SHA);
        // if (!REPO_OWNER || !REPO_NAME || !SHA) {
        //     console.log("One or more environment variables undefined");
        //     process.exit(1);
        // }
        // await downloadBaseConfigYML();
        // REPO_NAME = REPO_NAME.split("/")[1]
        // var {artifacts, documentId} = await getDocArtifacts(REPO_NAME);
        // docId = documentId;
        // console.log("Found Artifacts in document  ", artifacts.length);
        // var filePath = new Set();
        // for (var artifact of artifacts) {
        //     filePath.add(artifact.filePath);
        // }
        // Files = [...filePath];
        // console.log(`Found Total ${Files.length} file to be modified`);
        // await ReadFileAndWriteArtifacts();
        // await sleep(2000);
        // var docsBuild = execSync('mkdocs build');
        // console.log(docsBuild.toString());
        var navigation = getDocumentNavigation("mkdocs.yml")
        var normalizedNavigation = normalizeNavIndex.call(this, navigation);
        var tocMarkdown = createNavToc(normalizedNavigation);
        console.log(tocMarkdown);
        await generatePdfFromMd({content: tocMarkdown});
        console.log("Generated PDF for TOC");
        await generatePdfForDocument(normalizedNavigation);
        console.log("Generated PDF for Document");
        // var zipName = `${REPO_NAME.trim()}.zip`
        // var zipDir = execSync(`zip -r ${zipName} site/`)
        // console.log(zipDir.toString());
        // await sendZipToServer(`${zipName.trim()}`)
        console.timeEnd();
    } catch (e) {
        console.error(e);
        throw e;
    }
}


main();