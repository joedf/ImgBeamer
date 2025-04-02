/* globals

*/

/* exported
SetStageDialogTitle
*/

/** The number of stages to create */
const G_STAGES_COUNT = 9;

/** a global reference to the main body container that holds the boxes/stages.
 * @todo do we still need this? Maybe remove... */
var G_MAIN_CONTAINER = $('#main-container');

/** The calculated size of each box/stage */
const G_BOX_SIZE = GetOptimalBoxWidth(true, 30);
const G_BOXES_PER_ROW = 3; // TODO: maybe define in GetOptimalBoxWidth()?
// TODO: maybe move GetOptimalBoxWidth() here or into Utils?

// TODO: fix eslint errors and warnings

var _em_ = 12.96; //px
var _border_w_ = (2/3);
// var _titlebar_h_offset_ = 27.6333 - 3.767;
var _titlebar_h_offset_ = 15 + 0.2*_em_ + 0.3*_em_ + 2*_border_w_;


const G_STAGE_DLG = "stage-dlg";
let g_dlg_selector = '.' + G_STAGE_DLG;

function newStageDialog(parentContainer, startMinimized = false){
	$('<div class="' + G_STAGE_DLG + '"/>')
		.attr('dlg-start-minimized', startMinimized)
		.appendTo(parentContainer)
		.append('<div class="stageContainer"/>');
}

function SetStageDialogTitle(stage, title){
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
}

for (let i = 0; i < G_STAGES_COUNT; i++) {
	let startMinimized = (i > 5);
	newStageDialog(G_MAIN_CONTAINER, startMinimized);
}

$(g_dlg_selector).dialog({
	maxHeight: 800,
	maxWidth: 800,
	minHeight: 200,
	minWidth: 200,
	width: G_BOX_SIZE,
	height: G_BOX_SIZE + _titlebar_h_offset_,
	resizable: false,
	classes: {
		"ui-dialog": "stage-dialog",
	},
	drag: function( event, ui ) {
		// https://stackoverflow.com/a/20712561/883015
		var snapTolerance = (G_BOX_SIZE/10) + 0.2; //$(this).draggable('option', 'snapTolerance');
		var grid = {
			x: (G_BOX_SIZE/10) + 0.2,
			y: (G_BOX_SIZE + _titlebar_h_offset_) / 10,
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
		var snapTolerance = 80; //$(this).draggable('option', 'snapTolerance');
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

// tile dialogs
// position first one
$(g_dlg_selector).dialog('widget').eq(0).css({top:0, left:0});

// tile the first 6 dialogs
let dialogs = $(g_dlg_selector).dialog();
let dialogs_count = 6; // dialogs.length;
for (let i = 1; i < dialogs_count; i++) {
	const dialog = dialogs.eq(i);
	const prev = dialogs.eq(i-1).dialog('widget');

	if (i % G_BOXES_PER_ROW == 0) {
		const prev = dialogs.eq(i-G_BOXES_PER_ROW).dialog('widget');
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

// cascade the last 3 dialogs
let cascade_start = 6;
$(g_dlg_selector).eq(cascade_start).dialog({position: {my:"right top", at:"right top", of:'body'}});
for (let i = 7; i < dialogs.length; i++) {
	const base_z_index = 1000;
	const dialog = dialogs.eq(i);
	const prev = dialogs.eq(i-1).dialog('widget');
	const n = i - cascade_start;
	dialog.dialog('widget').css({
		top:80*n, right:80*n, left:'auto',
		'z-index':parseInt(prev.css('z-index'))+base_z_index + 1
	});
}
