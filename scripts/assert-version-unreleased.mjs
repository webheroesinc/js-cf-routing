// Checks package.json's version against the release tags (vX.Y.Z), for the
// master PR check so the failure shows before merge. Requires tags and the
// base branch to be fetched (checkout fetch-depth: 0).
//
// By default the version must be unreleased (no tag yet), i.e. it was bumped
// since the last release. With RELEASE_NONE=true (the PR has the release:none
// label) the reverse: the version must match the base branch's and already be
// tagged, so merging stages nothing. BASE_REF names the base branch.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

let tagged = false;
try {
    execSync(`git rev-parse -q --verify refs/tags/${tag}`, { stdio: 'ignore' });
    tagged = true;
} catch {
    tagged = false;
}

if (process.env.RELEASE_NONE === 'true') {
    const base = process.env.BASE_REF;
    const baseVersion = JSON.parse(
        execSync(`git show origin/${base}:package.json`, { encoding: 'utf8' })
    ).version;

    if (version !== baseVersion) {
        console.error(
            `::error::release:none, but this PR changes the version from ${baseVersion} ` +
                `to ${version}. Revert the version, or remove the label to release it.`
        );
        process.exit(1);
    }
    if (!tagged) {
        console.error(
            `::error::release:none, but version ${version} has no ${tag} tag, so merging ` +
                `would stage it on npm. Remove the label and release it.`
        );
        process.exit(1);
    }

    console.log(`release:none: version ${version} is unchanged and already tagged. OK.`);
    process.exit(0);
}

if (tagged) {
    console.error(
        `::error::version ${version} is already released (tag ${tag} exists). ` +
            `Bump the version in package.json before releasing, or add the ` +
            `release:none label to merge without releasing.`
    );
    process.exit(1);
}

console.log(`version ${version} is unreleased (no ${tag} tag). OK.`);
