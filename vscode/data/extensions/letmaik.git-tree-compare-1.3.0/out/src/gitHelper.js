"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const vscode_1 = require("vscode");
const git_1 = require("./git/git");
const askpass_1 = require("./git/askpass");
const util_1 = require("./git/util");
const readFile = util_1.denodeify(fs.readFile);
const stat = util_1.denodeify(fs.stat);
function createGit(outputChannel) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspaceRootPath = vscode_1.workspace.rootPath;
        const pathHint = vscode_1.workspace.getConfiguration('git').get('path');
        const info = yield git_1.findGit(pathHint, path => outputChannel.appendLine("Looking for git in: " + path));
        outputChannel.appendLine(`Using git ${info.version} from ${info.path}`);
        const askpass = new askpass_1.Askpass();
        const env = yield askpass.getEnv();
        return new git_1.Git({ gitPath: info.path, version: info.version, env });
    });
}
exports.createGit = createGit;
function getAbsGitDir(repo) {
    return __awaiter(this, void 0, void 0, function* () {
        // We don't use --absolute-git-dir here as that requires git >= 2.13.
        let res = yield repo.run(['rev-parse', '--git-dir']);
        let dir = res.stdout.trim();
        if (!path.isAbsolute(dir)) {
            dir = path.join(repo.root, dir);
        }
        return dir;
    });
}
exports.getAbsGitDir = getAbsGitDir;
function getAbsGitCommonDir(repo) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield repo.run(['rev-parse', '--git-common-dir']);
        let dir = res.stdout.trim();
        if (!path.isAbsolute(dir)) {
            dir = path.join(repo.root, dir);
        }
        return dir;
    });
}
exports.getAbsGitCommonDir = getAbsGitCommonDir;
function getDefaultBranch(repo, absGitCommonDir, head) {
    return __awaiter(this, void 0, void 0, function* () {
        // determine which remote HEAD is tracking
        let remote;
        if (head.name) {
            let headBranch;
            try {
                headBranch = yield repo.getBranch(head.name);
            }
            catch (e) {
                // this can happen on a newly initialized repo without commits
                return;
            }
            if (!headBranch.upstream) {
                return;
            }
            remote = headBranch.upstream.remote;
        }
        else {
            // detached HEAD, fall-back and try 'origin'
            remote = 'origin';
        }
        // determine default branch for the remote
        const remoteHead = remote + "/HEAD";
        const refs = yield repo.getRefs();
        if (refs.find(ref => ref.name == remoteHead) === undefined) {
            return;
        }
        // there is no git command equivalent to "git remote set-head" for reading the default branch
        // however, the branch name is in the file .git/refs/remotes/$remote/HEAD
        // the file format is:
        // ref: refs/remotes/origin/master
        const symRefPath = path.join(absGitCommonDir, 'refs', 'remotes', remote, 'HEAD');
        let symRef;
        try {
            symRef = yield readFile(symRefPath, 'utf8');
        }
        catch (e) {
            return;
        }
        const remoteHeadBranch = symRef.trim().replace('ref: refs/remotes/', '');
        return remoteHeadBranch;
    });
}
exports.getDefaultBranch = getDefaultBranch;
function getBranchCommit(absGitCommonDir, branchName) {
    return __awaiter(this, void 0, void 0, function* () {
        // a cheaper alternative to repo.getBranch()
        const refPathUnpacked = path.join(absGitCommonDir, 'refs', 'heads', branchName);
        try {
            const commit = (yield readFile(refPathUnpacked, 'utf8')).trim();
            return commit;
        }
        catch (e) {
            const refs = yield readPackedRefs(absGitCommonDir);
            const ref = `refs/heads/${branchName}`;
            const commit = refs.get(ref);
            if (commit === undefined) {
                throw new Error(`Could not determine commit for "${branchName}"`);
            }
            return commit;
        }
    });
}
exports.getBranchCommit = getBranchCommit;
function readPackedRefs(absGitCommonDir) {
    return __awaiter(this, void 0, void 0, function* () {
        // see https://git-scm.com/docs/git-pack-refs
        const packedRefsPath = path.join(absGitCommonDir, 'packed-refs');
        const content = yield readFile(packedRefsPath, 'utf8');
        const regex = /^([0-9a-f]+) (.+)$/;
        return new Map(content.split('\n')
            .map(line => regex.exec(line))
            .filter(g => !!g)
            .map((groups) => [groups[2], groups[1]]));
    });
}
function getMergeBase(repo, headRef, baseRef) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield repo.run(['merge-base', baseRef, headRef]);
        const mergeBase = result.stdout.trim();
        return mergeBase;
    });
}
exports.getMergeBase = getMergeBase;
function getHeadModificationDate(absGitDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const headPath = path.join(absGitDir, 'HEAD');
        const stats = yield stat(headPath);
        return stats.mtime;
    });
}
exports.getHeadModificationDate = getHeadModificationDate;
const MODE_REGULAR_FILE = '100644';
const MODE_EMPTY = '000000';
const MODE_SUBMODULE = '160000';
class DiffStatus {
    constructor(repo, status, relPath, srcMode, dstMode) {
        this.status = status;
        this.absPath = path.join(repo.root, relPath);
        this.isSubmodule = srcMode == MODE_SUBMODULE || dstMode == MODE_SUBMODULE;
    }
}
function sanitizeStatus(status) {
    if (status == 'U') {
        return 'C';
    }
    if (status.length != 1 || 'ADMT'.indexOf(status) == -1) {
        throw new Error('unsupported git status: ' + status);
    }
    return status;
}
// https://git-scm.com/docs/git-diff-index#_raw_output_format
const MODE_LEN = 6;
const SHA1_LEN = 40;
const SRC_MODE_OFFSET = 1;
const DST_MODE_OFFSET = 2 + MODE_LEN;
const STATUS_OFFSET = 2 * MODE_LEN + 2 * SHA1_LEN + 5;
const PATH_OFFSET = STATUS_OFFSET + 2;
function diffIndex(repo, ref) {
    return __awaiter(this, void 0, void 0, function* () {
        // exceptions can happen with newly initialized repos without commits, or when git is busy
        let diffIndexResult = yield repo.run(['diff-index', '--no-renames', ref, '--']);
        let untrackedResult = yield repo.run(['ls-files', '--others', '--exclude-standard']);
        const diffIndexStatuses = diffIndexResult.stdout.trim().split('\n')
            .filter(line => !!line)
            .map(line => new DiffStatus(repo, sanitizeStatus(line[STATUS_OFFSET]), line.substr(PATH_OFFSET).trim(), line.substr(SRC_MODE_OFFSET, MODE_LEN), line.substr(DST_MODE_OFFSET, MODE_LEN)));
        const untrackedStatuses = untrackedResult.stdout.trim().split('\n')
            .filter(line => !!line)
            .map(line => new DiffStatus(repo, 'U', line, MODE_EMPTY, MODE_REGULAR_FILE));
        const untrackedAbsPaths = new Set(untrackedStatuses.map(status => status.absPath));
        // If a file was removed (D in diff-index) but was then re-introduced and not committed yet,
        // then that file also appears as untracked (in ls-files). We need to decide which status to keep.
        // Since the untracked status is newer it gets precedence.
        const filteredDiffIndexStatuses = diffIndexStatuses.filter(status => !untrackedAbsPaths.has(status.absPath));
        const statuses = filteredDiffIndexStatuses.concat(untrackedStatuses);
        statuses.sort((s1, s2) => s1.absPath.localeCompare(s2.absPath));
        return statuses;
    });
}
exports.diffIndex = diffIndex;
//# sourceMappingURL=gitHelper.js.map