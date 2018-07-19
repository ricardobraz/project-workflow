## 1.3.0

* Moved tree view into source control container [#39](https://github.com/letmaik/vscode-git-tree-compare/issues/39)
* Fixed files not appearing if a file was removed and reintroduced without being committed yet [#41](https://github.com/letmaik/vscode-git-tree-compare/issues/41)

## 1.2.1

* Separated heads, tags, remote heads in base selector.
* Disabled "Open File" / "Open Changes" for submodule changes [#33](https://github.com/letmaik/vscode-git-tree-compare/issues/33).
* Added more logging to better diagnose issues.

## 1.2.0

* Added commands to open all changed files / all changes [#29](https://github.com/letmaik/vscode-git-tree-compare/issues/29).
* Added icon for folders which also avoids wrong node alignment [#17](https://github.com/letmaik/vscode-git-tree-compare/issues/17).
* Added `iconsMinimal` config option which allows to switch to a compact icon layout, comparable to the Seti file icon theme.
* Delay auto-refresh if VS Code is out of focus to minimize chances of disrupting a rebase operation or other git commands that need to acquire a lock to work [#24](https://github.com/letmaik/vscode-git-tree-compare/issues/24).
* Fixed extension not working on bigger repositories where git switched to packed refs [#30](https://github.com/letmaik/vscode-git-tree-compare/issues/30).

## 1.1.4

* Fixed extension only working on git >= 2.13, now works on older version again.
  This was caused by changes in the 1.1.3 extension release.

## 1.1.3

* Added support for type change (T) git status
* Fixed extension not working when using `git worktree` [#28](https://github.com/letmaik/vscode-git-tree-compare/issues/28)

## 1.1.2

* Restore original extension activation behaviour (only enable if a git repo is in the workspace)

## 1.1.1

* Fixed extension activation not working on VS Code 1.16.0.
Note that this is a temporary work-around which now always enables the extension, even if the workspace has no git repository (previously the extension would be disabled then). The work-around is necessary due to a [breaking change in VS Code](https://github.com/Microsoft/vscode/issues/33618) and makes sure that the extension keeps working for users with versions older than 1.16.0 as well as for newer versions.
Once VS Code 1.16.0 is rolled out to all users the final fix will be applied and the original behaviour can be restored. 
For details see [#23](https://github.com/letmaik/vscode-git-tree-compare/issues/23).

## 1.1.0

* Added support for detached HEAD, for example when checking out a tag, a remote branch, or a specific commit
* Fixed merge base not being updated if the checked out branch stays the same but points to a different commit, for example after pulling in upstream changes
* Fixed manual refresh not updating the merge base

## 1.0.0

* Initial release