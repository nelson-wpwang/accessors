"use strict";

var jsp;

function new_block (uuid) {
	var colors = {
		'a': '#5696BC',
		'b': '#E04836',
		'c': '#F39D41'
	}

	var new_block = $('#'+uuid);
	var w = new_block.width();
	var h = new_block.height();
	new_block.width(Math.ceil(new_block.width()/20)*20);

	//  Make the popup appear on dbl click
	// $('#'+uuid).dblclick(function () {
	// 	$(this).popover('show');
	// });

	// $(new_block).each(function() {
	// 	$(this).popover({
	// 		content: function () {
	// 			var p = $(this).find('.block_popup_content').html();
	// 			$(this).find('.block_popup_content').html('');
	// 			return p;
	// 		},
	// 		html: true,
	// 		placement: 'auto',
	// 		trigger: 'manual',
	// 		title: $(this).find('.block_popup_title').html(),
	// 		// container: $(new_block)
	// 	});
	// });

	// Initialize tooltips
	// $(new_block).find('.tooltipster').tooltipster({
	// 	theme: 'tooltipster-light',
	// });

	// Make the block dragable
	jsp.draggable(uuid, { grid:[10,10]});

	// var source_group = new_block.attr('data-source-group');
	// var target_group = new_block.attr('data-target-group');
	// var target_group_max_conn = new_block.attr('data-target-group-max-conn');


	// function add_source(b, pos, l, h) {

	// 	var source_endpoint = {
	// 		endpoint: ['Image', {src: '/static/right-arrow.png'}],
	// 		isSource: true,
	// 		connector: [ "Flowchart", { cornerRadius:5 } ],
	// 		anchor: [1, 0.4+(pos*(h/1600)), 0, 0],
	// 		overlays: [
	// 			['Label', {location: [0.3-(l.length*0.1), 0.5], label: l, cssClass:'labelLeft'}]
	// 		],
	// 	};
	// 	jsp.addEndpoint(b, source_endpoint);
	// }
	// console.log(h)


	// var dest_endpoint = {
	// 	endpoint: ['Image', {src: '/static/right-arrow.png'}],
	// 	isTarget: true,
	// 	connector: [ "Flowchart", { cornerRadius:5 } ],
	// 	anchor: [0, 0.5, 0.5, 1],
	// 	overlays: [
	// 		['Label', {location: [1.6, 0.5], label: 'Power'}]
	// 	],
	// };
	// jsp.addEndpoint($(new_block), dest_endpoint);

	return $(new_block);


	// Setup arrow properties
	// if (source_group) {
		// jsp.makeSource($(new_block), {
		// 	// filter: '.source-group', // make the block the source but only work from the little square
		// 	anchor: "Right",   // use the best anchor, but only in the middle of each side
		// 	connector:[ "Flowchart", { cornerRadius:5 } ], // make the connectors straight lines with 90 degree bends
		// 	connectorStyle:{ strokeStyle: 'blue',
		// 	                 lineWidth: 2,
		// 	                 outlineColor: "transparent",
		// 	                 outlineWidth: 4,
		// 	                 dashstyle: "0"
		// 	               },
		// 	connectorHoverStyle:{ strokeStyle: 'red',
		// 	                 lineWidth: 2,
		// 	                 outlineColor: "transparent",
		// 	                 outlineWidth: 4,
		// 	                 dashstyle: "2 2"
		// 	               },
		// 	// scope: source_group
		// });
	// }

	// if (target_group) {
	// 	jsp.makeTarget($(new_block), {
	// 		dropOptions: {hoverClass:"dragHover"},
	// 		anchor: "Left",
	// 		allowLoopback: false,
	// 		scope: target_group,
	// 		maxConnections: target_group_max_conn,
	// 		onMaxConnections: function(info, e) {
	// 			console.log("Maximum connections (" + info.maxConnections + ") reached");
	// 		}
	// 	});
	// }

}

// function save_profile () {
// 	var blocks = [];
// 	var connections = [];

// 	// Add all blocks
// 	$('.block').each(function () {
// 		var block = Object();
// 		block.uuid = $(this).attr('id');
// 		block.type = $(this).attr('data-type');

// 		var pos = $(this).position()
// 		block.top = pos.top;
// 		block.left = pos.left;

// 		var popup = $('#block_'+block.uuid+'_popup');

// 		// Save all of the parameters
// 		$(this).find('.parameter').each(function () {
// 			var key = $(this).attr('data-key');
// 			var val = $(this).attr('data-value');
// 			block[key] = val;
// 		});

// 		// Get the value of each setting
// 		popup.find('.setting').each(function () {
// 			var key = $(this).attr('data-key');
// 			var val = $(this).val();
// 			block[key] = val;
// 		});

// 		blocks.push(block);
// 	});

// 	// Add all unique connections
// 	var duplicates = {};
// 	var existing_connections = jsp.getAllConnections();
// 	for (var i=0; i<existing_connections.length; i++) {
// 		var src = existing_connections[i].sourceId;
// 		var tar = existing_connections[i].targetId;

// 		var dupe_check = src+tar;
// 		if (dupe_check in duplicates) {
// 			continue;
// 		}
// 		duplicates[dupe_check] = true;

// 		var connection = Object();
// 		connection.source_uuid = src;
// 		connection.target_uuid = tar;

// 		connections.push(connection);
// 	}

// 	var profile = Object();

// 	profile.uuid = $('#gatd-editor').attr('data-profile-uuid');
// 	profile.name = $('#profile-name').text();
// 	profile.blocks = blocks;
// 	profile.connections = connections;

// 	return profile;
// }


function add_source(b, pos, l, h, start) {

	var source_endpoint = {
		endpoint: ['Image', {src: '/static/right-arrow.png'}],
		isSource: true,
		connector: [ "Flowchart", { cornerRadius:5 } ],
		anchor: [1, start+(pos*(h/1600)), 0, 0],
		overlays: [
			['Label', {location: [0.2-(l.length*0.1), 0.5], label: l, cssClass:'labelLeft'}]
		],
	};
	jsp.addEndpoint(b, source_endpoint);
}

function add_dest(b, pos, l, h, start) {
	var dest_endpoint = {
		endpoint: ['Image', {src: '/static/right-arrow.png'}],
		isTarget: true,
		connector: [ "Flowchart", { cornerRadius:5 } ],
		anchor: [0,  start+(pos*(h/1600)), 0, 0],
		overlays: [
			['Label', {location: [1.7, 0.5], label: l, cssClass:'labelLeft'}]
		],
	};
	jsp.addEndpoint(b, dest_endpoint);
}


jsPlumb.ready(function() {

	console.log('create')

	// setup some defaults for jsPlumb.
	jsp = jsPlumb.getInstance({
		Endpoint:           ["Blank", {}],
		HoverPaintStyle:    {strokeStyle:"#1e8151", lineWidth:2 },
		ConnectionOverlays: [
			// ["Arrow", {
			// 	location: 1,
			// 	id:       "arrow",
			// 	length:   0,
			// 	foldback: 1
			// }],
   //  		["Label", {
   //  			label: 'X',
			// 	cssClass: 'aLabel',
			// 	id:"delete"
			// }]
		                    ],
		Container:          "editor"
	});

	// When a connection is created, update the attributes of the overlay
	// label so we can associate a click on it to the correct connection.
	// jsp.bind("connection", function(info) {
	// 	$(info.connection.getOverlay("delete").canvas)
	// 	  .attr('data-tar', info.connection.targetId)
	// 	  .attr('data-src', info.connection.sourceId)
	// 	  .attr('data-scope', info.connection.scope);
	// });

	// // Delete connection when the label is clicked
	// $('#gatd-editor').on('click', '.aLabel', function () {
	// 	var src = $(this).attr('data-src');
	// 	var tar = $(this).attr('data-tar');
	// 	var scope = $(this).attr('data-scope');

	// 	$.each(jsp.getConnections({scope:scope, source:src, target:tar}), function(i,v) {
	// 		jsp.detach(v);
	// 	});
	// });

	// Iterate through all saved blocks
	// $('.block').each(function () {
	// 	new_block($(this).attr('id'));
	// });







	var nb = $('#111');
	var h = nb.height();
	var b = new_block('111');
	add_source(b, 0, "Power", h, 0.4);
	add_source(b, 1, "PowerEvent", h, 0.4);
	add_source(b, 2, "Energy", h, 0.4);
	add_source(b, 3, "Voltage", h, 0.4);
	add_dest(b, 0, "Power", h, 0.4);

	var nb = $('#222');
	var h = nb.height();
	console.log(h)
	var b = new_block('222');
	add_source(b, 0, "Power", h, 0.6);
	// add_source(b, 1, "PowerEvent", h);
	// add_source(b, 2, "Energy", h);
	// add_source(b, 3, "Voltage", h);
	add_dest(b, 0, "Power", h, 0.6);













	// // Connect blocks
	// $('.connection').each(function () {
	// 	// var src = $(this).attr('data-src');
	// 	// var tar = $(this).attr('data-tar');
	// 	jsp.connect({source:src, target:tar});
	// });

	// // Make profile name editable
	// $('#profile-name').editable();

	// $(".gatd-editor-button").click(function () {
	// 	var block_type = $(this).attr('data-block');
	// 	var profile_uuid = $('#gatd-editor').attr('data-profile-uuid');
	// 	$.ajax('/editor/block/'+profile_uuid+'/'+block_type, {'dataType': 'json'})
	// 	.done(function (j) {
	// 		if (j.status != 'success') {
	// 			console.log('Error occurred getting block.');
	// 			return;
	// 		}
	// 		$("#gatd-editor").append(j.html);
	// 		new_block(j.block.uuid);
	// 	});
	// });

	// $('#gatd-editor-save').click(function () {
	// 	$('#gatd-editor .popover .close').trigger('click');

	// 	var data = save_profile();

	// 	$.ajax({
	// 		type: 'POST',
	// 		url: '/editor/save',
	// 		data: JSON.stringify(data),
	// 		contentType: 'application/json',
	// 		success: function () {
	// 			$('#modal-profile-save').modal('hide');
	// 		}
	// 	})
	// 	.fail(function () {
	// 		console.log('fail');
	// 	});
	// });

	// $('#gatd-editor-upload').click(function () {
	// 	$('#gatd-editor .popover .close').trigger('click');

	// 	var data = save_profile();

	// 	$.ajax({
	// 		type: 'POST',
	// 		url: '/editor/saveupload',
	// 		data: JSON.stringify(data),
	// 		contentType: 'application/json',
	// 		success: function (data) {
	// 			console.log(data);
	// 			$('#modal-profile-upload').modal('hide');
	// 		}
	// 	})
	// 	.fail(function () {
	// 		console.log('fail');
	// 	});
	// });

	// $('#gatd-editor').on('click', '.popover .close', function () {
	// 	var popid = $(this).attr('data-popover-id');
	// 	var block = $('#'+popid);

	// 	$(this).parents('.popover').find("input,select,textarea").each(function() {
	// 		if ($(this).is("[type='radio']") || $(this).is("[type='checkbox']")) {
	// 			if ($(this).prop("checked")) {
	// 				$(this).attr("checked", "checked");
	// 			}
	// 		} else {
	// 			if ($(this).is("select")) {
	// 				$(this).find(":selected").attr("selected", "selected");
	// 			} else if ($(this).is("textarea")) {
	// 				$(this).text($(this).val());
	// 			} else {
	// 				$(this).attr("value", $(this).val());
	// 			}
	// 		}
	// 	});

	// 	$(block).find('.block_popup_content').html($(this).parents('.popover').find('.popover-content').html());
	// 	$(block).popover('hide');
	// });

	// $('#gatd-editor').on('click', '.block-delete-button', function () {
	// 	var block_uuid = $(this).attr('data-block-uuid');
	// 	var block = $('#'+block_uuid);

	// 	$('#modal-block-delete .block-delete').click(function () {
	// 		$(block).popover('hide');

	// 		jsp.detachAllConnections($(block));
	// 		block.remove();

	// 		$(this).unbind('click');
	// 	});

	// 	$('#modal-block-delete').modal('show');

	// });

});
