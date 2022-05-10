import joplin from 'api';
import {ContentScriptType, MenuItemLocation, ToolbarButtonLocation} from "api/types";
import {settings} from "./settings";
import {
	ENABLE_AUTO_ANNOTATION_FETCH,
	ENABLE_IMAGE_ENHANCEMENT,
	ENABLE_LOCAL_PDF_PREVIEW,
	ENABLE_MERMAID_FOLDER, ENABLE_PAPERS, ENABLE_QUICK_COMMANDS,
	ENABLE_TABLE_FORMATTER, ENABLE_PSEUDOCODE
} from "./common";
import {syncAllPaperItems, updateAllInfoForOneNote, updateAnnotations} from "./driver/papers/papersUtils";
import {debounce} from "ts-debounce";

joplin.plugins.register({
	onStart: async function() {

		await settings.register();
		const enableTableFormatter = await joplin.settings.value(ENABLE_TABLE_FORMATTER);
		const enableMermaidFolder = await joplin.settings.value(ENABLE_MERMAID_FOLDER);
		const enableLocalPDFPreview = await joplin.settings.value(ENABLE_LOCAL_PDF_PREVIEW);
		const enableImageEnhancement = await joplin.settings.value(ENABLE_IMAGE_ENHANCEMENT);
		const enableQuickCommands = await joplin.settings.value(ENABLE_QUICK_COMMANDS);
		const enablePapers = await joplin.settings.value(ENABLE_PAPERS);
		const enableAutoAnnotationFetch = await joplin.settings.value(ENABLE_AUTO_ANNOTATION_FETCH);
		const enablePseudocode = await joplin.settings.value(ENABLE_PSEUDOCODE);

		if (enablePapers) {
			let updateAllInfoForOneNoteDebounce = debounce(updateAllInfoForOneNote, 200);
			const dialogs = joplin.views.dialogs;
			const beforeHandle = await dialogs.create('BeforeSyncDialog');
			await dialogs.setHtml(beforeHandle, '<p>You are trying to sync with your papers library.</p>' +
				'<p>Click "Ok" button to begin the synchronization</p>' +
				'<p>After clicking the "Ok" button, this dialog disappears, and the dialog will show again when the synchronization is finished.</p>' +
				'<p>It can spend several minutes, depending on your library size and network condition.</p>' +
				'<p><mark>Please DO NOT try to sync again until next dialog appears again!</mark></p>');
			await dialogs.setButtons(beforeHandle, [{id: 'ok'}, {id: 'cancel'}]);

			const errHandle = await dialogs.create('errSyncDialog');
			await dialogs.setHtml(errHandle, '<p>Error happens during sync with your Papers library. Please check your papers cookie and network connection.</p>');
			await dialogs.setButtons(errHandle, [{id: 'ok'}]);

			const finishHandle = await dialogs.create('finishSyncDialog');
			await dialogs.setHtml(finishHandle, '<p>Syncing with your Papers library finished.</p>')
			await dialogs.setButtons(finishHandle, [{id: 'ok'}]);

			await joplin.commands.register({
				name: "enhancement_papers_syncAll",
				label: "Sync All Files from Papers",
				execute: async () => {
					try {
						const result = await dialogs.open(beforeHandle);
						if (result.id === 'ok') {
							await syncAllPaperItems();
							await dialogs.open(finishHandle);
						}
					} catch (err) {
						if (err.message.code === 'ETIMEDOUT') {
							console.log("ETIMEDOUT in syncAllPaperItems()");
						}
						await dialogs.open(errHandle);
						return;
					}
				},
			});

			await joplin.commands.register({
				name: "enhancement_papers_updateAllInfo",
				label: "Update all info for current paper",
				iconName: "fas fa-sync",
				execute: async () => {
					const currNote = await joplin.workspace.selectedNote();
					try {
						await updateAllInfoForOneNoteDebounce(currNote.id, currNote.body);
					} catch (err) {
						if (err.message.code === 'ETIMEDOUT') {
							console.log("ETIMEDOUT in updateAllInfoForOneNote()");
						}
					}
				}
			})

			if (enableAutoAnnotationFetch) {
				await joplin.workspace.onNoteSelectionChange(async () => {
					const currNote = await joplin.workspace.selectedNote();
					try {
						await updateAllInfoForOneNote(currNote.id, currNote.body);
					} catch (err) {
						if (err.message.code === 'ETIMEDOUT') {
							console.log("ETIMEDOUT in updateAnnotations()");
						}
					}
				});
			}

			await joplin.views.menuItems.create(
				"syncAllFilesFromPapersLib",
				"enhancement_papers_syncAll",
				MenuItemLocation.Tools
			);

			await joplin.views.toolbarButtons.create(
				'updateAllInfoForCurrentPaper',
				'enhancement_papers_updateAllInfo',
				ToolbarButtonLocation.EditorToolbar,
			);
		}

		if (enableImageEnhancement) {
			await joplin.contentScripts.register(
				ContentScriptType.MarkdownItPlugin,
				'enhancement_figure_name',
				'./driver/markdownItRuler/index.js'
			);
		}

		if (enableLocalPDFPreview) {
			await joplin.contentScripts.register(
				ContentScriptType.MarkdownItPlugin,
				'enhancement_renderer',
				'./driver/markdownItRenderer/index.js'
			);
		}

		if (enableMermaidFolder) {
			await joplin.contentScripts.register(
				ContentScriptType.CodeMirrorPlugin,
				'enhancement_mermaid_folder',
				'./driver/codemirror/mermaidFolder/index.js'
			);

		}

		if (enableQuickCommands) {
			await joplin.contentScripts.register(
				ContentScriptType.CodeMirrorPlugin,
				'enhancement_quick_commands',
				'./driver/codemirror/quickCommands/index.js'
			);
		}

		if (enablePseudocode) {
			await joplin.contentScripts.register(
				ContentScriptType.MarkdownItPlugin,
				'enhancement_pseudocode_renderer',
				'./driver/markdownItRenderer/pseudocode/index.js'
			);
		}

		if (enableTableFormatter) {
			await joplin.contentScripts.register(
				ContentScriptType.CodeMirrorPlugin,
				'enhancement_table_formatter',
				'./driver/codemirror/tableFormatter/index.js'
			);

			await joplin.commands.register({
				name: 'alignColumnLeft',
				label: 'Align current column to left',
				iconName: 'fas fa-align-left',
				execute: async () => {
					await joplin.commands.execute('editor.execCommand', {
						name: 'alignColumns',
						args: [[':', '-']]
					});
				},
			});

			await joplin.commands.register({
				name: 'alignColumnRight',
				label: 'Align current column to right',
				iconName: 'fas fa-align-right',
				execute: async () => {
					await joplin.commands.execute('editor.execCommand', {
						name: 'alignColumns',
						args: [['-', ':']]
					});
				},
			});

			await joplin.commands.register({
				name: 'alignColumnCenter',
				label: 'Align current column to center',
				iconName: 'fas fa-align-center',
				execute: async () => {
					await joplin.commands.execute('editor.execCommand', {
						name: 'alignColumns',
						args: [[':', ':']]
					});
				},
			});

			await joplin.commands.register({
				name: 'alignColumnSlash',
				label: 'Remove the alignment of current column',
				iconName: 'fas fa-align-justify',
				execute: async () => {
					await joplin.commands.execute('editor.execCommand', {
						name: 'alignColumns',
						args: [['-', '-']]
					});
				},
			});

			await joplin.views.toolbarButtons.create(
				'align-column-left',
				'alignColumnLeft',
				ToolbarButtonLocation.EditorToolbar,
			);

			await joplin.views.toolbarButtons.create(
				'align-column-center',
				'alignColumnCenter',
				ToolbarButtonLocation.EditorToolbar,
			);

			await joplin.views.toolbarButtons.create(
				'align-column-right',
				'alignColumnRight',
				ToolbarButtonLocation.EditorToolbar,
			);

			await joplin.views.toolbarButtons.create(
				'align-column-slash',
				'alignColumnSlash',
				ToolbarButtonLocation.EditorToolbar,
			);
		}
	},
});