const simpleGit = require('simple-git');
const { EOL } = require('os')

const git = simpleGit();

const validate = async () => {
    const status = await git.status(['expected']);
    console.log(status.files.map(file => `${file.working_dir}: ${file.path}`).join(EOL) || '✅');
    process.exit(status.files.length)
}

validate();