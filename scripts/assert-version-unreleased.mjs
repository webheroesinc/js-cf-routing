// Fails if the package's current version already has a release tag (vX.Y.Z),
// i.e. the version wasn't bumped since the last release. Used by the master PR
// check so the failure shows before merge. Requires tags to be fetched
// (checkout fetch-depth: 0).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

let exists = false;
try {
    execSync(`git rev-parse -q --verify refs/tags/${tag}`, { stdio: 'ignore' });
    exists = true;
} catch {
    exists = false;
}

if (exists) {
    console.error(
        `::error::version ${version} is already released (tag ${tag} exists). ` +
            `Bump the version in package.json before releasing.`
    );
    process.exit(1);
}

console.log(`version ${version} is unreleased (no ${tag} tag). OK.`);
