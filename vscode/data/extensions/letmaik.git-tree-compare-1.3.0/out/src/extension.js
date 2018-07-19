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
const vscode_1 = require("vscode");
const constants_1 = require("./constants");
const treeProvider_1 = require("./treeProvider");
const gitHelper_1 = require("./gitHelper");
const util_1 = require("./git/util");
function activate(context) {
    const disposables = [];
    context.subscriptions.push(new vscode_1.Disposable(() => vscode_1.Disposable.from(...disposables).dispose()));
    const rootPath = vscode_1.workspace.rootPath;
    if (!rootPath) {
        return;
    }
    const outputChannel = vscode_1.window.createOutputChannel('Git Tree Compare');
    disposables.push(outputChannel);
    gitHelper_1.createGit(outputChannel).then((git) => __awaiter(this, void 0, void 0, function* () {
        const onOutput = str => outputChannel.append(str);
        git.onOutput.addListener('log', onOutput);
        disposables.push(util_1.toDisposable(() => git.onOutput.removeListener('log', onOutput)));
        const repositoryRoot = yield git.getRepositoryRoot(rootPath);
        const repository = git.open(repositoryRoot);
        const absGitDir = yield gitHelper_1.getAbsGitDir(repository);
        const absGitCommonDir = yield gitHelper_1.getAbsGitCommonDir(repository);
        const provider = new treeProvider_1.GitTreeCompareProvider(outputChannel, repository, absGitDir, absGitCommonDir, context.workspaceState);
        vscode_1.window.registerTreeDataProvider(constants_1.NAMESPACE, provider);
        vscode_1.commands.registerCommand(constants_1.NAMESPACE + '.openChanges', node => {
            if (!node) {
                return;
            }
            provider.openChanges(node);
        });
        vscode_1.commands.registerCommand(constants_1.NAMESPACE + '.openFile', node => {
            if (!node) {
                return;
            }
            provider.openFile(node);
        });
        vscode_1.commands.registerCommand(constants_1.NAMESPACE + '.changeBase', () => {
            provider.promptChangeBase();
        });
        vscode_1.commands.registerCommand(constants_1.NAMESPACE + '.refresh', () => {
            provider.manualRefresh();
        });
        vscode_1.commands.registerCommand(constants_1.NAMESPACE + '.openAllChanges', () => {
            provider.openAllChanges();
        });
        vscode_1.commands.registerCommand(constants_1.NAMESPACE + '.openChangedFiles', () => {
            provider.openChangedFiles();
        });
    }));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map