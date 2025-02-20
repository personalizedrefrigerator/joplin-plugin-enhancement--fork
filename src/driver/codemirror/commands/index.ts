export function initCommands(cm, CodeMirror) {
    const commandBridge = new CommandsBridge(cm);
    CodeMirror.defineExtension('markdownHL1', commandBridge.hL1.bind(commandBridge));
    CodeMirror.defineExtension('markdownHL2', commandBridge.hL2.bind(commandBridge));
    CodeMirror.defineExtension('markdownHL3', commandBridge.hL3.bind(commandBridge));
    CodeMirror.defineExtension('markdownHL4', commandBridge.hL4.bind(commandBridge));
    CodeMirror.defineExtension('markdownHL5', commandBridge.hL5.bind(commandBridge));
    CodeMirror.defineExtension('markdownHL6', commandBridge.hL6.bind(commandBridge));
    CodeMirror.defineExtension('markdownHL7', commandBridge.hL7.bind(commandBridge));
}

class CommandsBridge {
    constructor(private readonly cm) {
    }

    hL1() {
        this.hlWithColor('#ffd400');
    }

    hL2() {
        this.hlWithColor('#ff6666');
    }

    hL3() {
        this.hlWithColor('#5fb236');
    }

    hL4() {
        this.hlWithColor('#2ea8e5');
    }

    hL5() {
        this.hlWithColor('#a28ae5');
    }

    hL6() {
        this.hlWithColor('#e56eee');
    }

    hL7() {
        this.hlWithColor('#f19837');
    }

    hlWithColor(color: string) {
        if (this.cm.isReadOnly()) {
            return;
        }
        markdownInline(this.cm, `<mark style="background: ${color}">`, '</mark>', 'mark')
    }
}


/**
 * Converts selection into a markdown inline element (or removes formatting)
 *
 * @param  {CodeMirror.Editor} cm   The CodeMirror instance
 * @param  {string}            pre  The formatting mark before the element
 * @param  {string}            post The formatting mark behind the element
 */
function markdownInline (cm: CodeMirror.Editor, pre: string, post: string, tokentype?: string): void {
    // Is something selected?
    if (!cm.somethingSelected()) {
        // TODO: Check token type state at the cursor position to leave the
        // mode if already in the mode.
        let currentToken = cm.getTokenAt(cm.getCursor()).type
        if (tokentype !== undefined && currentToken !== null && currentToken?.includes(tokentype)) { // -- the tokentypes can be multiple (spell-error, e.g.)
            // We are, indeed, currently in this token. So let's check *how*
            // we are going to leave the state.
            let to = { 'line': cm.getCursor().line, 'ch': cm.getCursor().ch + post.length }
            if (cm.getRange(cm.getCursor(), to) === post) {
                cm.setCursor(to)
            } else {
                // No sign in sight -> insert it. Cursor will automatically move forward
                cm.replaceSelection(post)
            }
        } else {
            // Not in the mode -> simply do the standard.
            cm.replaceSelection(pre + '' + post, 'start')
            // Move cursor forward (to the middle of the insertion)
            const cur = cm.getCursor()
            cur.ch = cur.ch + pre.length
            cm.setCursor(cur)
        }
        return
    }

    // Build the regular expression by first escaping problematic characters
    let preregex = pre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let postregex = post.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    let re = new RegExp('^' + preregex + '.+?' + postregex + '$', 'g')

    const replacements = []
    for (const selection of cm.getSelections()) {
        if (re.test(selection)) {
            // We got something so unformat.
            replacements.push(selection.substr(pre.length, selection.length - pre.length - post.length))
        } else {
            // TODO: Check whether the user just selected the text itself and
            // not the formatting marks!

            // NOTE: Since the user can triple-click a line, that selection will
            // extend beyond the line. So check if the last char of selection is
            // a newline, and, if so, pluck that and push it after post.
            if (selection[selection.length - 1] === '\n') {
                replacements.push(pre + String(selection).substr(0, selection.length - 1) + post + '\n')
            } else {
                replacements.push(pre + selection + post)
            }
        }
    }

    // Replace with changes selections
    cm.replaceSelections(replacements, 'around')
}
