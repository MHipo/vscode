/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { IEditorContribution, ScrollType } from 'vs/editor/common/editorCommon';
import { IModelDeltaDecoration } from 'vs/editor/common/model';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { DragAndDropObserver } from 'vs/workbench/browser/dnd';
import { ITextEditorDragAndDropService } from 'vs/workbench/contrib/dnd/browser/dndService';
import { ITextEditorDataTransfer, ITextEditorDataTransferItem } from 'vs/workbench/contrib/dnd/common/dataTransfer';

export class DndEditorContribution extends Disposable implements IEditorContribution {

	static readonly ID: string = 'editor.contrib.dnd';

	private static readonly DECORATION_OPTIONS = ModelDecorationOptions.register({
		description: 'workbench-dnd-target',
		className: 'dnd-target'
	});

	private _dndDecorationIds: string[] = [];

	constructor(
		private readonly editor: ICodeEditor,
		@ITextEditorDragAndDropService textEditorDragAndDropService: ITextEditorDragAndDropService,
	) {
		super();

		this._register(new DragAndDropObserver(this.editor.getContainerDomNode(), {
			onDragEnter: e => undefined,
			onDragOver: e => {
				// noop
				const target = this.editor.getTargetAtClientPoint(e.clientX, e.clientY);
				if (target && target.position) {
					this.showAt(target.position);
				}
			},
			onDrop: async e => {
				this._removeDecoration();

				if (!e.dataTransfer) {
					return;
				}

				const target = this.editor.getTargetAtClientPoint(e.clientX, e.clientY);
				if (target?.position) {
					const dataTransfer: ITextEditorDataTransfer = new Map<string, ITextEditorDataTransferItem>();

					for (const item of e.dataTransfer.items) {
						if (item.kind === 'string') {
							const type = item.type;
							const asStringValue = new Promise<string>(resolve => item.getAsString(resolve));
							dataTransfer.set(type, {
								asString: () => asStringValue,
								value: undefined
							});
						}
					}

					if (dataTransfer.size > 0) {
						const controllers = textEditorDragAndDropService.getControllers(this.editor);
						for (const controller of controllers) {
							await controller.handleDrop(editor, target.position, dataTransfer, CancellationToken.None); // todo: add cancellation
						}
					}
				}
			},
			onDragLeave: e => this.dispose(),
			onDragEnd: e => {
				this._removeDecoration();
			},
		}));
	}

	private showAt(position: Position): void {
		let newDecorations: IModelDeltaDecoration[] = [{
			range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
			options: DndEditorContribution.DECORATION_OPTIONS
		}];

		this._dndDecorationIds = this.editor.deltaDecorations(this._dndDecorationIds, newDecorations);
		this.editor.revealPosition(position, ScrollType.Immediate);
	}

	private _removeDecoration(): void {
		this._dndDecorationIds = this.editor.deltaDecorations(this._dndDecorationIds, []);
	}
}
