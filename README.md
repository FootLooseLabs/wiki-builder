## Intro

this is the GitHub action builder script which is executed by github action to build static publicised version of the
site.
This script writes the artifacts to the file and then uploads the build to ec2 instance.

## Usage

```bash
npm run install
```

## IMP

Before pushing to git make sure to compile the code using `npm run build` command.

## Flow

1. The script will first write the artifacts to the file.
2. Then it will download the base.yml from s3
3. Then it will build the wiki using mkdocs.yml file using mkdocs.
4. Then it will zip the build
5. Then it will upload the build to the ec2 instance

## Add new Artifact

1. Add the artifact in the `AVAILABLE_WIDGET_TYPES` array in the `index.js` file. and target function which will generate the HTML preview of the artifact.
