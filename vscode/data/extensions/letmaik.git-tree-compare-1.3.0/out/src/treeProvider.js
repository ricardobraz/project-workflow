"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("./constants");
const git_1 = require("./git/git");
const util_1 = require("./git/util");
const uri_1 = require("./git/uri");
const gitHelper_1 = require("./gitHelper");
const decorators_1 = require("./git/decorators");
class FileElement {
    constructor(absPath, status, isSubmodule) {
        this.absPath = absPath;
        this.status = status;
        this.isSubmodule = isSubmodule;
    }
}
class FolderElement {
    constructor(absPath, useFilesOutsideTreeRoot) {
        this.absPath = absPath;
        this.useFilesOutsideTreeRoot = useFilesOutsideTreeRoot;
    }
}
class RepoRootElement extends FolderElement {
    constructor(absPath) {
        super(absPath, true);
        this.absPath = absPath;
    }
}
class RefElement {
    constructor(refName, hasChildren) {
        this.refName = refName;
        this.hasChildren = hasChildren;
    }
}
class ChangeBaseItem {
    constructor(ref) {
        this.ref = ref;
    }
    get shortCommit() { return (this.ref.commit || '').substr(0, 8); }
    get label() { return this.ref.name; }
    get description() { return this.shortCommit; }
}
class ChangeBaseTagItem extends ChangeBaseItem {
    get description() {
        return "Tag at " + this.shortCommit;
    }
}
class ChangeBaseRemoteHeadItem extends ChangeBaseItem {
    get description() {
        return "Remote branch at " + this.shortCommit;
    }
}
class GitTreeCompareProvider {
    constructor(outputChannel, repository, absGitDir, absGitCommonDir, workspaceState) {
        this.outputChannel = outputChannel;
        this.repository = repository;
        this.absGitDir = absGitDir;
        this.absGitCommonDir = absGitCommonDir;
        this.workspaceState = workspaceState;
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.loadedFolderElements = new Map();
        this.disposables = [];
        this.repoRoot = path.normalize(repository.root);
        this.readConfig();
        this.disposables.push(vscode_1.workspace.onDidChangeConfiguration(this.handleConfigChange, this));
        const fsWatcher = vscode_1.workspace.createFileSystemWatcher('**');
        this.disposables.push(fsWatcher);
        const onWorkspaceChange = util_1.anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        const onNonGitChange = util_1.filterEvent(onWorkspaceChange, uri => !/\/\.git\//.test(uri.path) && !/\/\.git$/.test(uri.path));
        const onGitRefsChange = util_1.filterEvent(onWorkspaceChange, uri => /\/\.git\/refs\//.test(uri.path));
        const onRelevantWorkspaceChange = util_1.anyEvent(onNonGitChange, onGitRefsChange);
        this.disposables.push(onRelevantWorkspaceChange(this.handleWorkspaceChange, this));
    }
    log(msg, error = undefined) {
        if (error) {
            console.warn(msg, error);
            msg = `${msg}: ${error.message}`;
        }
        this.outputChannel.appendLine(msg);
    }
    readConfig() {
        const config = vscode_1.workspace.getConfiguration(constants_1.NAMESPACE);
        if (config.get('root') === 'repository') {
            this.treeRoot = this.repoRoot;
        }
        else {
            this.treeRoot = vscode_1.workspace.rootPath;
        }
        this.includeFilesOutsideWorkspaceRoot = config.get('includeFilesOutsideWorkspaceRoot', true);
        this.openChangesOnSelect = config.get('openChanges', true);
        this.autoRefresh = config.get('autoRefresh', true);
        this.iconsMinimal = config.get('iconsMinimal', false);
    }
    getStoredBaseRef() {
        let baseRef = this.workspaceState.get('baseRef');
        if (baseRef !== undefined) {
            this.log('Using stored base ref: ' + baseRef);
        }
        return baseRef;
    }
    updateStoredBaseRef(baseRef) {
        this.workspaceState.update('baseRef', baseRef);
    }
    getTreeItem(element) {
        return toTreeItem(element, this.openChangesOnSelect, this.iconsMinimal);
    }
    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!element) {
                if (!this.filesInsideTreeRoot) {
                    try {
                        yield this.updateDiff(false);
                    }
                    catch (e) {
                        // some error occured, ignore and try again next time
                        this.log('Ignoring updateDiff() error during initial getChildren()', e);
                        return [];
                    }
                }
                const hasFiles = this.filesInsideTreeRoot.size > 0 ||
                    (this.includeFilesOutsideWorkspaceRoot && this.filesOutsideTreeRoot.size > 0);
                return [new RefElement(this.baseRef, hasFiles)];
            }
            else if (element instanceof RefElement) {
                const entries = [];
                if (this.includeFilesOutsideWorkspaceRoot && this.filesOutsideTreeRoot.size > 0) {
                    entries.push(new RepoRootElement(this.repoRoot));
                }
                return entries.concat(this.getFileSystemEntries(this.treeRoot, false));
            }
            else if (element instanceof FolderElement) {
                this.loadedFolderElements.set(element.absPath, element);
                return this.getFileSystemEntries(element.absPath, element.useFilesOutsideTreeRoot);
            }
            assert(false, "unsupported element type");
            return [];
        });
    }
    updateRefs(baseRef) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log('Updating refs');
            try {
                const headLastChecked = new Date();
                const HEAD = yield this.repository.getHEAD();
                // if detached HEAD, then .commit exists, otherwise only .name
                const headName = HEAD.name;
                const headCommit = HEAD.commit || (yield gitHelper_1.getBranchCommit(this.absGitCommonDir, HEAD.name));
                if (!baseRef) {
                    // TODO check that the ref still exists and ignore otherwise
                    baseRef = this.getStoredBaseRef();
                }
                if (!baseRef) {
                    baseRef = yield gitHelper_1.getDefaultBranch(this.repository, this.absGitCommonDir, HEAD);
                }
                if (!baseRef) {
                    if (HEAD.name) {
                        baseRef = HEAD.name;
                    }
                    else {
                        // detached HEAD and no default branch was found
                        // pick an arbitrary ref as base, give preference to common refs
                        const refs = yield this.repository.getRefs();
                        const commonRefs = ['origin/master', 'master'];
                        const match = refs.find(ref => ref.name !== undefined && commonRefs.indexOf(ref.name) !== -1);
                        if (match) {
                            baseRef = match.name;
                        }
                        else if (refs.length > 0) {
                            baseRef = refs[0].name;
                        }
                    }
                }
                if (!baseRef) {
                    // this should never happen
                    throw new Error('Base ref could not be determined!');
                }
                const HEADref = (HEAD.name || HEAD.commit);
                let mergeBase = baseRef;
                if (baseRef != HEAD.name) {
                    // determine merge base to create more sensible/compact diff
                    try {
                        mergeBase = yield gitHelper_1.getMergeBase(this.repository, HEADref, baseRef);
                    }
                    catch (e) {
                        // sometimes the merge base cannot be determined
                        // this can be the case with shallow clones but may have other reasons
                    }
                }
                if (this.headName !== headName) {
                    this.log(`HEAD ref updated: ${this.headName} -> ${headName}`);
                }
                if (this.headCommit !== headCommit) {
                    this.log(`HEAD ref commit updated: ${this.headCommit} -> ${headCommit}`);
                }
                if (this.baseRef !== baseRef) {
                    this.log(`Base ref updated: ${this.baseRef} -> ${baseRef}`);
                }
                if (this.mergeBase !== mergeBase) {
                    this.log(`Merge base updated: ${this.mergeBase} -> ${mergeBase}`);
                }
                this.headLastChecked = headLastChecked;
                this.headName = headName;
                this.headCommit = headCommit;
                this.baseRef = baseRef;
                this.mergeBase = mergeBase;
                this.updateStoredBaseRef(baseRef);
            }
            catch (e) {
                throw e;
            }
        });
    }
    updateDiff(fireChangeEvents) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.baseRef) {
                yield this.updateRefs();
            }
            const filesInsideTreeRoot = new Map();
            const filesOutsideTreeRoot = new Map();
            let diff = yield gitHelper_1.diffIndex(this.repository, this.mergeBase);
            this.log(`${diff.length} diff entries`);
            for (const entry of diff) {
                const folder = path.dirname(entry.absPath);
                const isInsideTreeRoot = folder === this.treeRoot || folder.startsWith(this.treeRoot + path.sep);
                const files = isInsideTreeRoot ? filesInsideTreeRoot : filesOutsideTreeRoot;
                const rootFolder = isInsideTreeRoot ? this.treeRoot : this.repoRoot;
                if (files.size == 0) {
                    files.set(rootFolder, new Array());
                }
                // add this and all parent folders to the folder map
                let currentFolder = folder;
                while (currentFolder != rootFolder) {
                    if (!files.has(currentFolder)) {
                        files.set(currentFolder, new Array());
                    }
                    currentFolder = path.dirname(currentFolder);
                }
                const entries = files.get(folder);
                entries.push(entry);
            }
            // determine folders in the old diff which have changed entries and fire change events
            const minDirtyFolders = [];
            if (fireChangeEvents) {
                const hasChanged = (folderPath, insideTreeRoot) => {
                    const oldFiles = insideTreeRoot ? this.filesInsideTreeRoot : this.filesOutsideTreeRoot;
                    const newFiles = insideTreeRoot ? filesInsideTreeRoot : filesOutsideTreeRoot;
                    const oldItems = oldFiles.get(folderPath).map(f => f.absPath);
                    const newItems = newFiles.get(folderPath).map(f => f.absPath);
                    for (const { files, items } of [{ files: oldFiles, items: oldItems },
                        { files: newFiles, items: newItems }]) {
                        // add direct subdirectories to items list
                        for (const folder of files.keys()) {
                            if (path.dirname(folder) === folderPath) {
                                items.push(folder);
                            }
                        }
                    }
                    return !sortedArraysEqual(oldItems, newItems);
                };
                const treeRootChanged = !filesInsideTreeRoot.size !== !this.filesInsideTreeRoot.size;
                const mustAddOrRemoveRepoRootElement = !filesOutsideTreeRoot.size !== !this.filesOutsideTreeRoot.size;
                if (treeRootChanged || mustAddOrRemoveRepoRootElement || (filesInsideTreeRoot.size && hasChanged(this.treeRoot, true))) {
                    // full refresh
                    this.loadedFolderElements.clear();
                    this._onDidChangeTreeData.fire();
                }
                else {
                    // collect all folders which had direct changes (not in subfolders)
                    const dirtyFoldersInsideTreeRoot = [];
                    const dirtyFoldersOutsideTreeRoot = [];
                    for (const folderPath of this.loadedFolderElements.keys()) {
                        const isTreeRootSubfolder = folderPath.startsWith(this.treeRoot + path.sep);
                        const files = isTreeRootSubfolder ? filesInsideTreeRoot : filesOutsideTreeRoot;
                        const dirtyFolders = isTreeRootSubfolder ? dirtyFoldersInsideTreeRoot : dirtyFoldersOutsideTreeRoot;
                        if (!files.has(folderPath)) {
                            // folder was removed; dirty state will be handled by parent folder
                            this.loadedFolderElements.delete(folderPath);
                        }
                        else if (hasChanged(folderPath, isTreeRootSubfolder)) {
                            dirtyFolders.push(folderPath);
                        }
                    }
                    // merge all subfolder changes with parent changes to obtain minimal set of change events
                    for (const dirtyFolders of [dirtyFoldersInsideTreeRoot, dirtyFoldersOutsideTreeRoot]) {
                        dirtyFolders.sort();
                        let lastAddedFolder = '';
                        for (const dirtyFolder of dirtyFolders) {
                            if (!dirtyFolder.startsWith(lastAddedFolder + path.sep)) {
                                minDirtyFolders.push(dirtyFolder);
                                lastAddedFolder = dirtyFolder;
                            }
                        }
                    }
                    // clean up old subfolder entries of minDirtyFolders in loadedFolderElements
                    // note that the folders in minDirtyFolders are kept so that events can be sent
                    // (those entries will be overwritten anyway after the tree update)
                    for (const dirtyFolder of minDirtyFolders) {
                        const dirtyPrefix = dirtyFolder + path.sep;
                        for (const loadedFolder of this.loadedFolderElements.keys()) {
                            if (loadedFolder.startsWith(dirtyPrefix)) {
                                this.loadedFolderElements.delete(loadedFolder);
                            }
                        }
                    }
                }
            }
            this.filesInsideTreeRoot = filesInsideTreeRoot;
            this.filesOutsideTreeRoot = filesOutsideTreeRoot;
            if (fireChangeEvents) {
                if (minDirtyFolders.length) {
                    this.log('Tree changes:');
                }
                else {
                    this.log('No tree changes');
                }
                // send events to trigger tree refresh
                for (const dirtyFolder of minDirtyFolders) {
                    this.log('  ' + path.relative(this.repoRoot, dirtyFolder));
                    const element = this.loadedFolderElements.get(dirtyFolder);
                    assert(element !== undefined);
                    this._onDidChangeTreeData.fire(element);
                }
            }
        });
    }
    isHeadChanged() {
        return __awaiter(this, void 0, void 0, function* () {
            // Note that we can't rely on filesystem change notifications for .git/HEAD
            // because the workspace root may be a subfolder of the repo root
            // and change notifications are currently limited to workspace scope.
            // See https://github.com/Microsoft/vscode/issues/3025.
            const mtime = yield gitHelper_1.getHeadModificationDate(this.absGitDir);
            if (mtime > this.headLastChecked) {
                return true;
            }
            // At this point we know that HEAD still points to the same symbolic ref or commit (if detached).
            // If HEAD is not detached, check if the symbolic ref resolves to a different commit.
            if (this.headName) {
                // this.repository.getBranch() is not used here to avoid git invocation overhead
                const headCommit = yield gitHelper_1.getBranchCommit(this.absGitCommonDir, this.headName);
                if (this.headCommit !== headCommit) {
                    return true;
                }
            }
            return false;
        });
    }
    handleWorkspaceChange(path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.autoRefresh) {
                return;
            }
            if (!vscode_1.window.state.focused) {
                const onDidFocusWindow = util_1.filterEvent(vscode_1.window.onDidChangeWindowState, e => e.focused);
                yield util_1.eventToPromise(onDidFocusWindow);
                this.handleWorkspaceChange(path);
                return;
            }
            if (yield this.isHeadChanged()) {
                // make sure merge base is updated when switching branches
                try {
                    yield this.updateRefs(this.baseRef);
                }
                catch (e) {
                    // some error occured, ignore and try again next time
                    this.log('Ignoring updateRefs() error during handleWorkspaceChange()', e);
                    return;
                }
            }
            try {
                yield this.updateDiff(true);
            }
            catch (e) {
                // some error occured, ignore and try again next time
                this.log('Ignoring updateDiff() error during handleWorkspaceChange()', e);
                return;
            }
        });
    }
    handleConfigChange() {
        const oldRoot = this.treeRoot;
        const oldInclude = this.includeFilesOutsideWorkspaceRoot;
        const oldOpenChangesOnSelect = this.openChangesOnSelect;
        const oldAutoRefresh = this.autoRefresh;
        const oldIconsMinimal = this.iconsMinimal;
        this.readConfig();
        if (oldRoot != this.treeRoot ||
            oldInclude != this.includeFilesOutsideWorkspaceRoot ||
            oldOpenChangesOnSelect != this.openChangesOnSelect ||
            oldIconsMinimal != this.iconsMinimal ||
            (!oldAutoRefresh && this.autoRefresh)) {
            this._onDidChangeTreeData.fire();
        }
    }
    getFileSystemEntries(folder, useFilesOutsideTreeRoot) {
        const entries = [];
        const files = useFilesOutsideTreeRoot ? this.filesOutsideTreeRoot : this.filesInsideTreeRoot;
        // add direct subfolders
        for (const folder2 of files.keys()) {
            if (path.dirname(folder2) === folder) {
                entries.push(new FolderElement(folder2, useFilesOutsideTreeRoot));
            }
        }
        // add files
        const fileEntries = files.get(folder);
        // there is no mapping entry if treeRoot!=repoRoot and
        // there are no files within treeRoot, therefore, this is guarded
        if (fileEntries) {
            for (const file of fileEntries) {
                entries.push(new FileElement(file.absPath, file.status, file.isSubmodule));
            }
        }
        return entries;
    }
    openChanges(fileEntry) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.doOpenChanges(fileEntry.absPath, fileEntry.status);
        });
    }
    doOpenChanges(absPath, status, preview = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const right = vscode_1.Uri.file(absPath);
            const left = uri_1.toGitUri(right, this.mergeBase);
            if (status === 'U' || status === 'A') {
                return vscode_1.commands.executeCommand('vscode.open', right);
            }
            if (status === 'D') {
                return vscode_1.commands.executeCommand('vscode.open', left);
            }
            const options = {
                preview: preview
            };
            const filename = path.basename(absPath);
            yield vscode_1.commands.executeCommand('vscode.diff', left, right, filename + " (Working Tree)", options);
        });
    }
    openAllChanges() {
        for (let file of this.iterFiles()) {
            this.doOpenChanges(file.absPath, file.status, false);
        }
    }
    openFile(fileEntry) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.doOpenFile(fileEntry.absPath, fileEntry.status);
        });
    }
    doOpenFile(absPath, status, preview = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const right = vscode_1.Uri.file(absPath);
            const left = uri_1.toGitUri(right, this.mergeBase);
            const uri = status === 'D' ? left : right;
            const options = {
                preview: preview
            };
            return vscode_1.commands.executeCommand('vscode.open', uri, options);
        });
    }
    openChangedFiles() {
        for (let file of this.iterFiles()) {
            if (file.status == 'D') {
                continue;
            }
            this.doOpenFile(file.absPath, file.status, false);
        }
    }
    *iterFiles() {
        for (let filesMap of [this.filesInsideTreeRoot, this.filesOutsideTreeRoot]) {
            for (let files of this.filesInsideTreeRoot.values()) {
                for (let file of files) {
                    if (!file.isSubmodule) {
                        yield file;
                    }
                }
            }
        }
    }
    promptChangeBase() {
        return __awaiter(this, void 0, void 0, function* () {
            const refs = (yield this.repository.getRefs()).filter(ref => ref.name);
            const heads = refs.filter(ref => ref.type === git_1.RefType.Head).map(ref => new ChangeBaseItem(ref));
            const tags = refs.filter(ref => ref.type === git_1.RefType.Tag).map(ref => new ChangeBaseTagItem(ref));
            const remoteHeads = refs.filter(ref => ref.type === git_1.RefType.RemoteHead).map(ref => new ChangeBaseRemoteHeadItem(ref));
            const picks = [...heads, ...tags, ...remoteHeads];
            const placeHolder = 'Select a ref to use as comparison base';
            const choice = yield vscode_1.window.showQuickPick(picks, { placeHolder });
            if (!choice) {
                return;
            }
            const baseRef = choice.ref.name;
            if (this.baseRef === baseRef) {
                return;
            }
            vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Window, title: 'Updating Tree Base' }, (p) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.updateRefs(baseRef);
                }
                catch (e) {
                    let msg = 'Updating the git tree base failed';
                    this.log(msg, e);
                    vscode_1.window.showErrorMessage(`${msg}: ${e.message}`);
                    return;
                }
                try {
                    yield this.updateDiff(false);
                }
                catch (e) {
                    let msg = 'Updating the git tree failed';
                    this.log(msg, e);
                    vscode_1.window.showErrorMessage(`${msg}: ${e.message}`);
                    // clear the tree as it would be confusing to display the old tree under the new base
                    this.filesInsideTreeRoot = new Map();
                    this.filesOutsideTreeRoot = new Map();
                }
                // manual cleaning necessary as the whole tree is updated
                this.log('Updating full tree');
                this.loadedFolderElements.clear();
                this._onDidChangeTreeData.fire();
            }));
        });
    }
    manualRefresh() {
        return __awaiter(this, void 0, void 0, function* () {
            vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Window, title: 'Updating Tree' }, (p) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (yield this.isHeadChanged()) {
                        // make sure merge base is updated when switching branches
                        yield this.updateRefs(this.baseRef);
                    }
                    yield this.updateDiff(true);
                }
                catch (e) {
                    let msg = 'Updating the git tree failed';
                    this.log(msg, e);
                    vscode_1.window.showErrorMessage(`${msg}: ${e.message}`);
                }
            }));
        });
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
__decorate([
    decorators_1.throttle
], GitTreeCompareProvider.prototype, "updateDiff", null);
__decorate([
    decorators_1.debounce(2000)
], GitTreeCompareProvider.prototype, "handleWorkspaceChange", null);
exports.GitTreeCompareProvider = GitTreeCompareProvider;
function toTreeItem(element, openChangesOnSelect, iconsMinimal) {
    const iconRoot = path.join(__dirname, '..', '..', 'resources', 'icons');
    if (element instanceof FileElement) {
        const label = path.basename(element.absPath);
        const item = new vscode_1.TreeItem(label);
        item.contextValue = element.isSubmodule ? 'submodule' : 'file';
        item.id = element.absPath;
        item.iconPath = path.join(iconRoot, toIconName(element) + '.svg');
        if (!element.isSubmodule) {
            const command = openChangesOnSelect ? 'openChanges' : 'openFile';
            item.command = {
                command: constants_1.NAMESPACE + '.' + command,
                arguments: [element],
                title: ''
            };
        }
        return item;
    }
    else if (element instanceof RepoRootElement) {
        const label = '/';
        const item = new vscode_1.TreeItem(label, vscode_1.TreeItemCollapsibleState.Collapsed);
        item.contextValue = 'root';
        item.id = 'root';
        if (!iconsMinimal) {
            item.iconPath = {
                light: path.join(iconRoot, 'light', 'FolderOpen_16x.svg'),
                dark: path.join(iconRoot, 'dark', 'FolderOpen_16x_inverse.svg')
            };
        }
        return item;
    }
    else if (element instanceof FolderElement) {
        const label = path.basename(element.absPath);
        const item = new vscode_1.TreeItem(label, vscode_1.TreeItemCollapsibleState.Expanded);
        item.contextValue = 'folder';
        item.id = element.absPath;
        if (!iconsMinimal) {
            item.iconPath = {
                light: path.join(iconRoot, 'light', 'FolderOpen_16x.svg'),
                dark: path.join(iconRoot, 'dark', 'FolderOpen_16x_inverse.svg')
            };
        }
        return item;
    }
    else if (element instanceof RefElement) {
        const label = element.refName;
        const state = element.hasChildren ? vscode_1.TreeItemCollapsibleState.Expanded : vscode_1.TreeItemCollapsibleState.None;
        const item = new vscode_1.TreeItem(label, state);
        item.contextValue = 'ref';
        item.id = 'ref';
        if (!iconsMinimal) {
            item.iconPath = {
                light: path.join(iconRoot, 'light', 'git-compare.svg'),
                dark: path.join(iconRoot, 'dark', 'git-compare.svg')
            };
        }
        return item;
    }
    throw new Error('unsupported element type');
}
function toIconName(element) {
    switch (element.status) {
        case 'U': return 'status-untracked';
        case 'A': return 'status-added';
        case 'D': return 'status-deleted';
        case 'M': return 'status-modified';
        case 'C': return 'status-conflict';
        case 'T': return 'status-typechange';
    }
}
function sortedArraysEqual(a, b) {
    if (a.length != b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=treeProvider.js.map