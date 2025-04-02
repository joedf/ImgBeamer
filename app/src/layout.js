/* globals Utils */
/* exported LayoutManager */

/**
 * Dialog and layout setup and helper functions
 * @namespace LayoutManager
 */
const LayoutManager = {

	/** The array/list of all the stages. */
	Stages: [],

	/** The number of stages to create */
	stages_count: 9,

	/** The calculated size of each box/stage, changes when .Initialize() is called. */
	box_size: 300, // default value

	/** The minimum size of a stage */
	minSize: 200,

	/** The maximum size of a stage */
	maxSize: 800,
	
	// UI and layout related values
	_stage_dialog_class: "stage-dlg",
	_stageContainer_class: "stageContainer",
	_stages_per_row: 3,
	
	/** a reference to the main body container that holds the boxes/stages. */
	_main_container: $('#main-container'),

	/** The base z-index to use for cascading dialogs */
	_cascade_dialog_base_z_index: 1000,

	Initialize: function(){
		this.box_size = this.__GetOptimalBoxWidth(true);
		this.Stages = this.__SetupStages();
	},

	/**
	 * Sets the title on the dialog window of a given stage.
	 * @param {object} stage the stage.
	 * @param {string} title the title to set.
	 */
	SetDialogTitle: function (stage, title){
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

	/**
	 * Positions dialogs in a tiled layout.
	 * All dialogs by default, otherwise for a given range.
	 * @param {*} tile_start the dialog to start tiling with.
	 * @param {*} tile_end the last dialog to tile.
	 */
	TileDialogs: function(tile_start=0, tile_end=null){
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let dialogs = $(g_dlg_selector).dialog();

		tile_end = (tile_end==null) ? dialogs.length : tile_end;
		
		// position first one
		$(g_dlg_selector).dialog('widget').eq(tile_start).css({top:0, left:0});

		// position the rest
		for (let i = tile_start + 1; i < tile_end; i++) {
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
	},

	/**
	 * Positions dialogs in a cascaded layout from the top right to the bottom left.
	 * All dialogs by default, otherwise for a given range.
	 * @param {*} cascade_start the dialog to start cascading with.
	 * @param {*} cascade_end the last dialog to cascade.
	 * @param {*} cascade_offset the distance between each cascaded dialog in x and y.
	 */
	// eslint-disable-next-line no-magic-numbers
	CascadeDialogs: function(cascade_start=0, cascade_end=null, cascade_offset=80){
		// cascade the last n dialogs
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let dialogs = $(g_dlg_selector).dialog();

		cascade_end = (cascade_end==null) ? dialogs.length : cascade_end;

		// position first one
		$(g_dlg_selector).eq(cascade_start).dialog({position: {my:"right top", at:"right top", of:'body'}});

		// position the rest
		for (let i = cascade_start + 1; i < cascade_end; i++) {
			const dialog = dialogs.eq(i);
			const prev = dialogs.eq(i-1).dialog('widget');
			const nDiaglog = i - cascade_start;
			
			dialog.dialog('widget').css({
				top: cascade_offset*nDiaglog,
				right: cascade_offset*nDiaglog,
				left: 'auto',
				'z-index': parseInt(prev.css('z-index'))+this._cascade_dialog_base_z_index + 1
			});
		}
	},

	/**
	 * Calculated the size to use for each drawing box/stage.
	 * Edit the values in the functions to change the box sizing.
	 * @returns The size to use.
	 */
	// eslint-disable-next-line no-magic-numbers
	__GetOptimalBoxWidth: function(considerViewportHeight=false, titlebarHeight=30){
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

		// bound/clamp the number to the size limits
		calculatedBoxSize = Utils.clampValue(calculatedBoxSize, this.minSize, this.maxSize);
		
		return calculatedBoxSize;
	},

	/**
	 * [Private] Creates a DOM element to be used for a stage dialog.
	 * @param {*} parentContainer the DOM element of the parent container in which to add a stage dialog.
	 * @param {*} startMinimized Whether or not the dialog should start minimized.
	 */
	__newStageDialog: function(parentContainer, startMinimized = false){
		$('<div class="' + this._stage_dialog_class + '"/>')
			.attr('dlg-start-minimized', startMinimized)
			.appendTo(parentContainer)
			.append('<div class="' + this._stageContainer_class + '"/>');
	},

	__ShouldStageDialogStartMinimized: function(i){
		// eslint-disable-next-line no-magic-numbers
		return (i > 5);
	},

	__SetupDialogs: function(stages_count){
		var me = this;
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let parentContainer = this._main_container;
		
		var _em_ = 12.96; //px
		var _border_w_ = (2/3);
		// eslint-disable-next-line no-magic-numbers
		var _titlebar_h_offset_ = 15 + 0.2*_em_ + 0.3*_em_ + 2*_border_w_;
		
		let drag_snap = {
			// eslint-disable-next-line no-magic-numbers
			x: (me.box_size/10) + 0.2,
			// eslint-disable-next-line no-magic-numbers
			y: (me.box_size + _titlebar_h_offset_) / 10,
		};

		// create the containers for the dialogs
		for (let i = 0; i < stages_count; i++) {
			let startMinimized = this.__ShouldStageDialogStartMinimized(i);
			LayoutManager.__newStageDialog(parentContainer, startMinimized);
		}

		// transform them into jquery-ui extented dialogs with options
		$(g_dlg_selector).dialog({
			maxHeight: me.maxSize,
			maxWidth: me.maxSize,
			minHeight: me.minSize,
			minWidth: me.minSize,
			width: me.box_size,
			height: me.box_size + _titlebar_h_offset_,
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

	__SetupStages: function(layoutDialogs=true){
		// first, set up the dialogs
		this.__SetupDialogs(this.stages_count);

		// optionally, tile the dialogs
		if (layoutDialogs) {
			let advanced_dialogs_start = 6;
			this.TileDialogs(0, advanced_dialogs_start);
			this.CascadeDialogs(advanced_dialogs_start, this.stages_count);
		}
		
		// then create the stages and plug them in
		let stages = [];
		let g_stage_containers = $('.'+this._stageContainer_class);
		for (let i = 0; i < this.stages_count; i++) {
			let stage = Utils.newStageTemplate(g_stage_containers[i], this.box_size, this.box_size);
			stages.push(stage);
		}
		return stages;
	},
};

// initialize, do calculations, create the stages, and setup UI
LayoutManager.Initialize();
