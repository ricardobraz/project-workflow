'use strict';

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {

    const commandDisposables: vscode.Disposable[] = [];

    commandDisposables.push(vscode.commands.registerCommand('qub-textedits.toUpperCase', toUpperCase));
    commandDisposables.push(vscode.commands.registerCommand('qub-textedits.toLowerCase', toLowerCase));
    commandDisposables.push(vscode.commands.registerCommand('qub-textedits.removeWhitespace', removeWhitespace));

    context.subscriptions.push(vscode.Disposable.from(...commandDisposables));
}

export function deactivate(): void {
}

/**
 * If there is an active text editor and it has selections, convert the selections to upper case.
 */
function toUpperCase() {
    applySelectionStringChange((text: string) => { return text.toUpperCase(); });
}

/**
 * If there is an active text editor and it has selections, convert the selections to lower case.
 */
function toLowerCase() {
    applySelectionStringChange((text: string) => { return text.toLowerCase(); });
}

/**
 * Remove any whitespace within the current selections.
 */
function removeWhitespace() {
    applySelectionStringChange((text: string) => {
        let nonWhitespaceText: string = "";
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
function applySelectionStringChange(selectionStringChange: (text: string) => string): void {
    const activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document && activeEditor.selections) {
        const activeDocument: vscode.TextDocument = activeEditor.document;
        const selections: vscode.Selection[] = activeEditor.selections;
        if (selections.length > 0) {
            const editRanges: vscode.Range[] = [];

            for (const selection of selections) {
                if (!selection.isEmpty) {
                    const selectionRange = new vscode.Range(selection.start, selection.end);
                    const selectionText: string = activeDocument.getText(selectionRange);
                    if (selectionText && selectionStringChange(selectionText) !== selectionText) {
                        editRanges.push(selectionRange);
                    }
                }
            }

            if (editRanges.length > 0) {
                activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                    for (const editRange of editRanges) {
                        editBuilder.replace(editRange, selectionStringChange(activeDocument.getText(editRange)));
                    }
                });
            }
        }
    }
}