/* globals
Utils
*/

/* exported
G_STAGES_COUNT
LayoutManager
*/

/** The number of stages to create */
const G_STAGES_COUNT = 9;

/**
 * Dialog and layout setup and helper functions
 * @namespace LayoutManager
 */
const LayoutManager = {

	minSize: 200,
	maxSize: 800,
	_stage_dialog_class: "stage-dlg",
	stageContainer_class: "stageContainer",
	_stages_per_row: 3,
	
	/** a global reference to the main body container that holds the boxes/stages.
	* @todo do we still need this? Maybe remove... */
	_main_container: $('#main-container'),

	SetupStages: function(){
		let stages = [];
		let g_stage_containers = $('.'+this.stageContainer_class);
		// first create the stages
		for (let i = 0; i < G_STAGES_COUNT; i++) {
			let stage = Utils.newStageTemplate(g_stage_containers[i], G_BOX_SIZE, G_BOX_SIZE);
			stages.push(stage);
		}
		return stages;
	},

	/**
	 * Calculated the size to use for each drawing box/stage.
	 * Edit the values in the functions to change the box sizing.
	 * @returns The size to use.
	 */
	// eslint-disable-next-line no-magic-numbers
	GetOptimalBoxWidth: function(considerViewportHeight=false, titlebarHeight=30){
		// Values used to calculate the size of each box/stage
		var boxesPerPageWidth = this._stages_per_row;
		// count-in the width of the borders of the boxes
		var boxBorderW = 2 * (parseInt($('.box:first').css('border-width')) || 1);
		var scrollBarW = 15; // scroll bar width
		var boxSizeMax = 450; //max width for the boxes

		// make sure to have an integer value to prevent slight sizing differences between each box
		var calculatedBoxSize = Math.ceil(Math.min(
			(document.body.clientWidth / boxesPerPageWidth) - boxBorderW - scrollBarW,
			boxSizeMax));

		if (considerViewportHeight) {
			let boxMaxH = Math.floor((window.innerHeight / 2) - titlebarHeight);
			calculatedBoxSize = Math.min(calculatedBoxSize, boxMaxH);
		}
		
		return calculatedBoxSize;
	},

	/**
	 * Creates a DOM element to be used for a stage dialog.
	 * @param {*} parentContainer the DOM element of the parent container in which to add a stage dialog.
	 * @param {*} startMinimized Whether or not the dialog should start minimized.
	 */
	newStageDialog: function(parentContainer, startMinimized = false){
		$('<div class="' + this._stage_dialog_class + '"/>')
			.attr('dlg-start-minimized', startMinimized)
			.appendTo(parentContainer)
			.append('<div class="' + this.stageContainer_class + '"/>');
	},

	/**
	 * Sets the title on the dialog window of a given stage.
	 * @param {object} stage the stage.
	 * @param {string} title the title to set.
	 */
	SetStageDialogTitle: function (stage, title){
		let e = stage.getContainer();
		let dlgCnt = e.closest('.ui-dialog-content');
		if (dlgCnt != null) {
			let dlg = $(dlgCnt).dialog();
			// set jquery-ui dialog title
			dlg.dialog('option', 'title', title);
			// support for minimized dialogExtend dialogs
			if (typeof dlg.dialogExtend == 'function') {
				const dlgExtCntr = $('#dialog-extend-fixed-container');
				let dlg_id = dlg.dialog('widget').find('.ui-dialog-title').attr('id');
				let dlgExt = dlgExtCntr.find('#'+dlg_id);
				if (dlgExt.length) {
					dlgExt.text(title);
				}
			}
		}
	},

	__ShouldStageDialogStartMinimized: function(i){
		// eslint-disable-next-line no-magic-numbers
		return (i > 5);
	},

	SetupDialogs: function(stages_count=G_STAGES_COUNT){
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let parentContainer = this._main_container;
		let box_size = G_BOX_SIZE;
		
		var _em_ = 12.96; //px
		var _border_w_ = (2/3);
		// eslint-disable-next-line no-magic-numbers
		var _titlebar_h_offset_ = 15 + 0.2*_em_ + 0.3*_em_ + 2*_border_w_;
		
		let drag_snap = {
			// eslint-disable-next-line no-magic-numbers
			x: (box_size/10) + 0.2,
			// eslint-disable-next-line no-magic-numbers
			y: (box_size + _titlebar_h_offset_) / 10,
		};

		for (let i = 0; i < stages_count; i++) {
			let startMinimized = this.__ShouldStageDialogStartMinimized(i);
			LayoutManager.newStageDialog(parentContainer, startMinimized);
		}

		var me = this;
		
		$(g_dlg_selector).dialog({
			maxHeight: me.maxSize,
			maxWidth: me.maxSize,
			minHeight: me.minSize,
			minWidth: me.minSize,
			width: box_size,
			height: box_size + _titlebar_h_offset_,
			resizable: false,
			classes: { "ui-dialog": "stage-dialog" },
			drag: function( event, ui ) {
				// https://stackoverflow.com/a/20712561/883015
				var snapTolerance = drag_snap.x;
				var grid = {
					x: drag_snap.x,
					y: drag_snap.y,
				};
		
				var topRemainder = ui.position.top % grid.y;
				var leftRemainder = ui.position.left % grid.x;
		
				if (topRemainder <= snapTolerance) {
					ui.position.top = ui.position.top - topRemainder;
				}
		
				if (leftRemainder <= snapTolerance) {
					ui.position.left = ui.position.left - leftRemainder;
				}
			},
			resize: function( event, ui ) {
				// https://stackoverflow.com/a/20712561/883015
				var snapTolerance = 80;
				var grid = {
					x: 20,
					y: 20,
				};
		
				var widthRemainder = ui.size.width % grid.x;
				var heightRemainder = ui.size.height % grid.y;
				
				if (widthRemainder <= snapTolerance) {
					ui.size.width = ui.size.width - widthRemainder;
				}
		
				if (heightRemainder <= snapTolerance) {
					ui.size.height = ui.size.height - heightRemainder;
				}
			}
		}).dialogExtend({
			"closable" : false,
			"maximizable" : false,
			"minimizable" : true,
			"collapsable" : true,
			"dblclick" : "collapse",
			"minimizeLocation" : "right",
			"icons": {
				"collapse": "ui-icon-arrowthickstop-1-n"
			},
			"load": function(){
				var e = $(this);
				if (e.attr('dlg-start-minimized') == 'true') {
					e.dialogExtend('minimize');
				}
			}
		});
	},

	TileDialogs: function(){
		let g_dlg_selector = '.' + this._stage_dialog_class;
		const base_z_index = 1000;
		
		// tile the first n dialogs
		let tile_end = 6;
		// position first one
		$(g_dlg_selector).dialog('widget').eq(0).css({top:0, left:0});
		let dialogs = $(g_dlg_selector).dialog();
		for (let i = 1; i < tile_end; i++) {
			const dialog = dialogs.eq(i);
			const prev = dialogs.eq(i-1).dialog('widget');

			if (i % this._stages_per_row == 0) {
				const prev = dialogs.eq(i-this._stages_per_row).dialog('widget');
				var eDialog = prev.get(0);
				var newPos = {
					x: parseInt(prev.css('left')),
					y: eDialog.offsetHeight + parseInt(prev.css('top')),
				};
				dialog.dialog('widget').css({top:newPos.y, left:newPos.x});
			} else {
				dialog.dialog({position: {my:"left top", at:"right top", of:$(prev)}});
			}
		}

		// cascade the last n dialogs
		let cascade_start = 6;
		let cascade_offset = 80;
		// position first one
		$(g_dlg_selector).eq(cascade_start).dialog({position: {my:"right top", at:"right top", of:'body'}});
		for (let i = cascade_start + 1; i < dialogs.length; i++) {
			const dialog = dialogs.eq(i);
			const prev = dialogs.eq(i-1).dialog('widget');
			const nDiaglog = i - cascade_start;
			dialog.dialog('widget').css({
				top: cascade_offset*nDiaglog,
				right: cascade_offset*nDiaglog,
				left: 'auto',
				'z-index': parseInt(prev.css('z-index'))+base_z_index + 1
			});
		}
	},
};

/** The calculated size of each box/stage
 * @todo do we still need this? Maybe remove... */
const G_BOX_SIZE = LayoutManager.GetOptimalBoxWidth(true);
