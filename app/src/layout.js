/* globals
Utils
G_Update_Stages_Global
G_VSEM_STAGE
G_VSEM_PAUSED
G_GUI_Controller
G_GUI_PRELOADED_IMGS_SELECTMENU
G_GUI_ADVANCE_MODE_CB
*/

/* exported LayoutManager, G_VSEM_PAUSED */

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
	
	// -----------------------------------------------------
	// UI and layout related values
	// -----------------------------------------------------
	// the class of the element used for jquery dialog objects
	_stage_dialog_class: "stage-dlg",
	// the class of the entire dialog element
	_dialog_parent_class: "stage-dialog",
	// the id for the menubar / topbar
	_menubar_id: "menubar",
	// ids for menubar checkboxes
	_cb_hide_options: "cb_hide_options",
	_cb_advanced_mode: "cb_advanced_mode",
	// the class of a stage's parent element
	_stageContainer_class: "stageContainer",
	_stages_per_row: 3,
	_stages_per_column: 2,
	
	/** a reference to the main body container that holds the boxes/stages. */
	_main_container: $('#main-container'),
	
	/** The base z-index to use for cascading dialogs */
	_cascade_dialog_base_z_index: 100,
	
	// advanced mode stages start at this index for the stages array
	__advanced_dialogs_start: 6,
	
	// -----------------------------------------------------
	// URLs
	// -----------------------------------------------------
	_URLs: {
		home: 'https://joedf.github.io/ImgBeamer',
		guide: 'https://joedf.github.io/ImgBeamer/misc/ImgBeamer_QS_guide.pdf',
	},
	
	// -----------------------------------------------------
	Initialize: function(){
		var me = this;
		$(document).ready(function(){
			me.__onDocReady();
		});

		// eslint-disable-next-line no-magic-numbers
		this.box_size = this.__GetOptimalBoxWidth(true, 30);
		this.Stages = this.__SetupStages();
	},
	
	__onDocReady: function(){
		this.__SetupMenubar();
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
	 * Adds the given class to the dialog element associated to the given stage.
	 * @param {*} stage the stage
	 * @param {string} className the class name
	 */
	DialogAddClass: function(stage, className){
		let dlg = this.GetDialogForStage(stage);
		if (dlg.length) {
			dlg.addClass(className);
		}
	},

	/**
	 * Gets the dialog element for the given stage.
	 * @param {*} stage the stage
	 * @param {Boolean} inner Specify true to get the inner element that is used for jQuery.dialog().
	 * @returns The associated dialog element for the given stage.
	 */
	GetDialogForStage: function(stage, inner=false){
		let stageContainer = stage.getContainer();
		let dialog = $(stageContainer).closest("." + this._dialog_parent_class);

		if (inner) {
			dialog = dialog.find('.ui-dialog-content');
		}

		return dialog;
	},

	/**
	 * Positions dialogs in a tiled layout.
	 * All dialogs by default, otherwise for a given range.
	 * @param {integer} tile_start the dialog to start tiling with.
	 * @param {integer} tile_end the last dialog to tile.
	 */
	TileDialogs: function(tile_start=0, tile_end=null){
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let dialogs = $(g_dlg_selector).dialog();

		tile_end = (tile_end==null) ? dialogs.length : tile_end;

		let parentPos = this._main_container.position();
		let start_x = parentPos.left;
		let start_y = parentPos.top;

		// position first one
		$(g_dlg_selector).dialog('widget').eq(tile_start).css({top:start_y, left:start_x});

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
	 * @param {integer} cascade_start the dialog to start cascading with.
	 * @param {integer} cascade_end the last dialog to cascade.
	 * @param {Number} offset_x the distance between each cascaded dialog in x.
	 * @param {Number} offset_y the distance between each cascaded dialog in y.
	 */
	// eslint-disable-next-line no-magic-numbers
	CascadeDialogs: function(cascade_start=0, cascade_end=null, offset_x=100, offset_y=80){
		// cascade the last n dialogs
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let dialogs = $(g_dlg_selector).dialog();

		cascade_end = (cascade_end==null) ? dialogs.length : cascade_end;

		// position first one
		let first = $(g_dlg_selector).eq(cascade_start).dialog({
			position: {
				my: "right top",
				at: "right top",
				of: this._main_container
			}
		});

		let firstPos = first.position();

		// position the rest
		for (let i = cascade_start + 1; i < cascade_end; i++) {
			const dialog = dialogs.eq(i);
			const prev = dialogs.eq(i-1).dialog('widget');
			const nDiaglog = i - cascade_start;
			
			dialog.dialog('widget').css({
				top: offset_y*nDiaglog + firstPos.top,
				right: offset_x*nDiaglog + firstPos.left,
				left: 'auto',
				'z-index': parseInt(prev.css('z-index'))+this._cascade_dialog_base_z_index + 1
			});
		}
	},

	/**
	 * 
	 * Calculated the size to use for each drawing box/stage.
	 * Edit the values in the functions to change the box sizing.
	 * @param {Boolean} considerViewportHeight Whether or not the box height can be reduced to fit the client area.
	 * @param {Number} vpFootOffset The amount of space to further offset at the bottom of the client area.
	 * @param {Number} titlebarHeight The height of a dialog's titlebar (used for calculations).
	 * @returns The size to use.
	 */
	// eslint-disable-next-line no-magic-numbers
	__GetOptimalBoxWidth: function(considerViewportHeight=false, vpFootOffset=0, titlebarHeight=30){
		// Values used to calculate the size of each box/stage
		let boxesPerPageWidth = this._stages_per_row;
		// count-in the width of the borders of the boxes
		let boxBorderW = 2 * (parseInt($('.box:first').css('border-width')) || 1);
		let scrollBarW = 15; // scroll bar width
		let boxSizeMax = this.maxSize - titlebarHeight; //max width for the boxes

		// calculate the box width based on how many we want per page-width
		let calculatedBoxSize = Math.min(
			(document.body.clientWidth / boxesPerPageWidth) - boxBorderW - scrollBarW,
			boxSizeMax);

		// optionally limit size further to fit at least n rows of boxes
		if (considerViewportHeight) {
			let boxMaxH = Math.floor((window.innerHeight / this._stages_per_column) - titlebarHeight);
			calculatedBoxSize = Math.min(calculatedBoxSize, boxMaxH);

			// further, reduce if we want a larger foot margin space
			calculatedBoxSize = calculatedBoxSize - (vpFootOffset / this._stages_per_column);
		}

		// make sure to have an integer value to prevent slight sizing differences between each box
		calculatedBoxSize = Math.ceil(calculatedBoxSize);

		// bound/clamp the number to the size limits
		calculatedBoxSize = Utils.clampValue(calculatedBoxSize, this.minSize, this.maxSize);

		return calculatedBoxSize;
	},

	/**
	 * Determines if a given stage is visible to the user (as defined by
	 * https://api.jquery.com/visible-selector/)
	 * @param {*} stage the (konva) stage to test visibility
	 * @returns true if visible, false otherwise
	 */
	IsStageVisible: function(stage) {
		let container = stage.getContainer();
		let visible = $(container).is(':visible');
		return visible;
	},

	/**
	 * Prints whether each stage is visible or not to the user in the web console.
	 * Useful for debugging.
	 */
	__visible_stages: function() {
		let stages = this.Stages;
		for(let i = 0; i < stages.length; i++) {
			let vis = this.IsStageVisible(stages[i]);
			console.log("stage #"+i+" visibility = " + vis);
		}
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

	// eslint-disable-next-line no-unused-vars
	__ShouldStageDialogStartMinimized: function(i){
		// eslint-disable-next-line no-magic-numbers
		// return (i >= this.__advanced_dialogs_start);
		
		// Start none as minimized for now
		// see https://github.com/joedf/ImgBeamer/issues/53#issuecomment-2776922914
		return false;
	},

	__SetupDialogs: function(stages_count){
		var me = this;
		let g_dlg_selector = '.' + this._stage_dialog_class;
		let parentContainer = this._main_container;

		let parentTop = parentContainer.position().top;
		
		var _em_ = 12.96; //px
		var _border_w_ = (2/3);
		// eslint-disable-next-line no-magic-numbers
		var _titlebar_h_offset_ = 15 + 0.2*_em_ + 0.3*_em_ + 2*_border_w_;
		
		let drag_snap = {
			// eslint-disable-next-line no-magic-numbers
			x: (me.box_size/10) + 0.2,
			// eslint-disable-next-line no-magic-numbers
			y: (me.box_size + _titlebar_h_offset_ + parentTop) / 10,
		};

		// create the containers for the dialogs
		for (let i = 0; i < stages_count; i++) {
			let startMinimized = this.__ShouldStageDialogStartMinimized(i);
			this.__newStageDialog(parentContainer, startMinimized);
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
			classes: { "ui-dialog": me._dialog_parent_class },
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
					let newTop = ui.position.top - topRemainder;
					// dont allow position height than the parent container
					ui.position.top = Math.max(newTop, parentTop);
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
			},
			"restore": me.__onDialogShow.bind(me),
			"maximize": me.__onDialogShow.bind(me),
			"collapse": me.__onDialogHide.bind(me),
			"minimize": me.__onDialogHide.bind(me),
		});

		// Contain the dialog within the parent container
		$("."+this._dialog_parent_class).draggable( "option", "containment", parentContainer );
	},

	__onDialogShow: function(evt) {
		// called when a dialog has been restored or maximized,
		// i.e. content is made visible to the user
		if (typeof G_Update_Stages_Global == 'function') {
			G_Update_Stages_Global();
		}

		// check if we should "un-pause" / resume the VSEM stage rendering
		if (G_VSEM_STAGE != null && typeof G_GUI_Controller != 'undefined')
		{
			let isVSemStageDialog = this.__isDialogForStage(evt.target, G_VSEM_STAGE);
			if (isVSemStageDialog) {
				// if the dialog is the VSEM stage, then we can restore the rendering / drawing flag
				// Yes, the user could potentially unpause while it was collapsed, but that is not critical
				
				// since collapse/minimize, restore the value from the GUI checkbox
				// eslint-disable-next-line no-global-assign
				G_VSEM_PAUSED = G_GUI_Controller.pause_vSEM;
			}
		}
	},

	__onDialogHide: function(evt) {
		// called when a dialog has been collapse or minimized,
		// i.e. content is being made hidden to the user
		
		if (G_VSEM_STAGE != null) {
			let isVSemStageDialog = this.__isDialogForStage(evt.target, G_VSEM_STAGE);
			if (isVSemStageDialog) {
				// if the dialog is the VSEM stage, then we can pause the rendering / drawing
				
				// we explicitly pause the VSEM rendering, whether it was already paused or not
				// eslint-disable-next-line no-global-assign
				G_VSEM_PAUSED = true;
			}
		}
	},

	/**
	 * Determines whether the given dialog is associated with the given stage.
	 * @param {*} dialogElement The dialog.
	 * @param {*} stage The stage.
	 * @returns True if they are associated, false otherwise.
	 */
	__isDialogForStage: function(dialogElement, stage) {
		let $dialog = $(dialogElement);
		let dlg_stageContainer = $dialog.find('.stageContainer > .box:first').get(0);
		let stageContainer = stage.getContainer();
		let isMatch = (stageContainer == dlg_stageContainer);
		return isMatch;
	},

	__SetupStages: function(layoutDialogs=true){
		// first, set up the dialogs
		this.__SetupDialogs(this.stages_count);

		// optionally, tile the dialogs
		if (layoutDialogs) {
			this.TileDialogs(0, this.__advanced_dialogs_start);
			this.CascadeDialogs(this.__advanced_dialogs_start, this.stages_count);
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

	__SetupMenubar: function(){
		let el = $('#'+this._menubar_id);
		let gui = G_GUI_Controller;
		var me = this;
		el.menu('option', 'select', function(event){
			// console.log(event);

			let target = event.currentTarget;
			let textraw = target.innerText;
			let text = textraw.toLocaleLowerCase();
			let keyword = text.split(' ')[0];

			if (text.indexOf('.png')>1) { keyword = '__preloaded'; }
			// prevent handling erroneous drag-clicking
			if (keyword == '__preloaded' && textraw.indexOf('\n')>=0) {
				return;
			}
			
			switch(keyword){
				case 'import':
					gui.importImage();
					break;
				case '__preloaded': //preloaded images
					// set the selected preloaded image, by using the options GUI controller
					// simulates as if the user click that option, so other things trigger correctly
					G_GUI_PRELOADED_IMGS_SELECTMENU.setValue(textraw);
					break;
				case 'save':
					if (text.indexOf('actual') >= 0) {
						gui.exportResultTrueImage();
					} else{
						gui.exportResultImg();
					}
					break;
				case 'advanced': //mode
					// get the check state in the menubar
					var _cbchk_am = $('#'+me._cb_advanced_mode).is(':checked');
					G_GUI_ADVANCE_MODE_CB.setValue(_cbchk_am);
					break;
				case 'tile': // displays/dialogs
					// Ensure no dialog is collapsed before tiling, otherwise it won't work right...
					$("."+me._stage_dialog_class).dialogExtend("restore");
					me.TileDialogs(0, me.__advanced_dialogs_start);
					break;
				case 'homepage':
					window.open(me._URLs.home,'_blank').focus();
					break;
				case 'quick-start':
					window.open(me._URLs.guide,'_blank').focus();
					break;
				case 'hide': // Hide Options
					var _cbchk_ho = $('#'+me._cb_hide_options).is(':checked');
					$('#options-anchor').toggle(!_cbchk_ho);
					break;
				case 'about':
						gui.aboutMessage();
					break;
				case 'quit':
						// doesnt work for user-opened origin pages
						// window.close();
						// instead replace page (in history) with repo page for now
						window.location.replace(me._URLs.home);
					break;
			}
		});
		// don't overwrite the focus handler from jquery-ui-menubar
		let _onFocus = el.menu('option', 'focus').bind(el);
		// we want to add to it
		el.menu('option', 'focus', function(event, ui){
			// call original handler first
			// which positions submenus correctly
			_onFocus(event, ui);

			// ensure advanced mode checkbox is updated
			var __checked = G_GUI_ADVANCE_MODE_CB.getValue();
			$('#'+me._cb_advanced_mode).prop('checked', __checked);
		});
	},
};
