var sz = 300;
var mc = $('#main-container');

// first create the stages
var stages = [];
for (let i = 0; i < 3; i++) {
	var e = $('<div/>').addClass('box').appendTo(mc);
	var stage = new Konva.Stage({
		container: e.get(0),
		width: sz,
		height: sz
	});
	// then create layer and to stage
	var layer = new Konva.Layer();
	stage.add(layer);
	stages.push(stage);
}


// create our shape
var circle = new Konva.Circle({
	x: stage.width() / 2,
	y: stage.height() / 2,
	radius: 70,
	fill: 'cyan',
	stroke: 'red',
	strokeWidth: 4,
});

var s1l = stages[0].getLayers()[0];

// add the shape to the layer
s1l.add(circle);

// draw the image
s1l.draw();

/////////////////////

var max = sz;
var img_width = 1800, img_height = 1350;
var ratio = (img_width > img_height ? (img_height / max) : (img_width / max)) // fill
// fit: var ratio = (img_width > img_height ? (img_width / max) : (img_height / max))

var grains1 = null;

var imageObj = new Image();
imageObj.onload = function () {
	grains1 = new Konva.Image({
		x: 0,
		y: 0,
		image: imageObj,
		width: img_width/ratio,
		height: img_height/ratio,
	});

	// add the shape to the layer
	stages[1].getLayers()[0].add(grains1);

	step3();
};
imageObj.src = 'src/testimages/grains1.png';


function step3(){
	var s3l = stages[2].getLayers()[0];
	// needed for layers only - listening=false? clonedLayer = layer.clone({ listening: false });
	var cc = circle.clone();
	cc.draggable(true);
	var gr = grains1.clone();
	gr.draggable(true);
	
	gr.globalCompositeOperation('xor');

	s3l.add(cc);
	s3l.add(gr);
	/*
	var rect = new Konva.Rect({
		x: 50,
		y: 50,
		// stroke: 'red',
		width: 100,
		height: 100,
		fill: 'red',
		draggable: true,
		globalCompositeOperation: 'xor',
	});
	*/
}