'use strict';
const vscode = require('vscode');
function activate(context) {
    const commandDisposables = [];
    commandDisposables.push(vscode.commands.registerCommand('qub-textedits.toUpperCase', toUpperCase));
    commandDisposables.push(vscode.commands.registerCommand('qub-textedits.toLowerCase', toLowerCase));
    commandDisposables.push(vscode.commands.registerCommand('qub-textedits.removeWhitespace', removeWhitespace));
    context.subscriptions.push(vscode.Disposable.from(...commandDisposables));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
/**
 * If there is an active text editor and it has selections, convert the selections to upper case.
 */
function toUpperCase() {
    applySelectionStringChange((text) => { return text.toUpperCase(); });
}
/**
 * If there is an active text editor and it has selections, convert the selections to lower case.
 */
function toLowerCase() {
    applySelectionStringChange((text) => { return text.toLowerCase(); });
}
/**
 * Remove any whitespace within the current selections.
 */
function removeWhitespace() {
    applySelectionStringChange((text) => {
        let nonWhitespaceText = "";
        for (const character of text) {
            switch (character) {
                case " ":
                case "\t":
                    break;
                default:
                    nonWhitespaceText += character;
            }
        }
        return nonWhitespaceText;
    });
}
/**
 * Apply the generic text change function to each of the currently selected ranges.
 */
function applySelectionStringChange(selectionStringChange) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document && activeEditor.selections) {
        const activeDocument = activeEditor.document;
        const selections = activeEditor.selections;
        if (selections.length > 0) {
            const editRanges = [];
            for (const selection of selections) {
                if (!selection.isEmpty) {
                    const selectionRange = new vscode.Range(selection.start, selection.end);
                    const selectionText = activeDocument.getText(selectionRange);
                    if (selectionText && selectionStringChange(selectionText) !== selectionText) {
                        editRanges.push(selectionRange);
                    }
                }
            }
            if (editRanges.length > 0) {
                activeEditor.edit((editBuilder) => {
                    for (const editRange of editRanges) {
                        editBuilder.replace(editRange, selectionStringChange(activeDocument.getText(editRange)));
                    }
                });
            }
        }
    }
}
//# sourceMappingURL=TextEditExtension.js.map