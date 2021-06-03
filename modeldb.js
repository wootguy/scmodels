
var g_model_data = {};
var g_view_model_data = {};
var g_old_versions = {}; // for filtering
var g_groups = {};
var g_tags = {};
var g_verions = [];
var g_aliases = {};
var g_group_filter = '';
var g_model_names;
var can_load_new_model = false;
var model_load_queue;
var model_unload_waiting;
var hlms_is_ready = false;
var g_db_files_loaded = 0;
var g_debug_mode = false; // for quickly creating lists of models for tagging/grouping

// returning from the group view_model
var g_offset_before_group = 0;
var g_search_before_group = 0;

var model_results; // subset of g_model_names
var results_per_page = 40;
//var result_offset = 0;
var result_offset = 1201;
var data_repo_domain = "https://wootdata.github.io/";
var data_repo_count = 32;
var renderWidth = 500;
var renderHeight = 800;
var antialias = 2;
var g_3d_enabled = true;
var g_model_was_loaded = false;
var g_view_model_name = "";
var g_groups_with_results = {};
var g_model_path = "models/player/";

var g_debug_copy = "";

function fetchTextFile(path, callback) {
	var httpRequest = new XMLHttpRequest();
	httpRequest.onreadystatechange = function() {
		if (httpRequest.readyState === 4 && httpRequest.status === 200 && callback) {
			callback(httpRequest.responseText);
		}
	};
	httpRequest.open('GET', path + '?nocache=' + (new Date()).getTime());
	httpRequest.send();
}

function fetchBinaryFile(path, callback) {
	var httpRequest = new XMLHttpRequest();
	httpRequest.onreadystatechange = function() {
		if (httpRequest.readyState === 4 && httpRequest.status === 200 && callback) {
			callback(httpRequest.response);
		}
	};
	httpRequest.open('GET', path);
	httpRequest.responseType = "blob";
	httpRequest.send();
}

function fetchJSONFile(path, callback) {	
	fetchTextFile(path, function(data) {
		try {
			callback(JSON.parse(data));
		} catch(e) {
			console.error("Failed to load JSON file: " + path +"\n\n", e);
			var loader = document.getElementsByClassName("site-loader")[0];
			loader.classList.remove("loader");
			loader.textContent = "Failed to load file: " + path;
		}
	});
}

function stopDownloads() {
	if (!hlms_is_ready) {
		console.log("Can't cancel yet");
		return; // don't want to cancel this accidentally
	}
	
	if (window.stop !== undefined) {
		window.stop();
	}
	else if (document.execCommand !== undefined) {
		document.execCommand("Stop", false);
	}   
}

function hlms_load_model(model_name, t_model, seq_groups) {
	var repo_url = get_repo_url(model_name);
	var model_path = repo_url + "models/player/" + model_name + "/";
	
	if (can_load_new_model) {
		Module.ccall('load_new_model', null, ['string', 'string', 'string', 'number'], [model_path, model_name, t_model, seq_groups], {async: true});
		can_load_new_model = false;
		return true;
	} else {
		console.log("Can't load a new model yet. Waiting for previous model to load.");
		model_load_queue = model_name;
		
		var popup = document.getElementById("model-popup");
		popup.getElementsByClassName("loader")[0].style.visibility = "hidden";
		popup.getElementsByClassName("loader-text")[0].textContent = "Failed to load. Try refreshing.";
		
		return false;
	}
}

function humanFileSize(size) {
    var i = Math.floor( Math.log(size) / Math.log(1024) );
    return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
};

function update_model_details() {
	var popup = document.getElementById("model-popup");
	
	var totalPolys = 0;
	var hasLdModel = false;
	for (var i = 0; i < g_view_model_data["bodies"].length; i++) {
		let models = g_view_model_data["bodies"][i]["models"];
		let polys = parseInt(models[0]["polys"]);
		
		if (models.length > 1) {
			hasLdModel = true;
			if (document.getElementById("cl_himodels").checked) {
				polys = parseInt(models[models.length-1]["polys"]); // cl_himodels 1 (default client setting)
			}
		}
		
		totalPolys += polys;
	}
	
	if (hasLdModel) {
		popup.getElementsByClassName("hd_setting")[0].style.display = "block";
	}
	
	var soundTable = "";
	for (var i = 0; i < g_view_model_data["events"].length; i++) {
		var evt = g_view_model_data["events"][i];
		if (evt["event"] == 5004 && evt["options"].length > 0) {
			var seq = evt["sequence"];
			var seqName = seq + " : " + g_view_model_data["sequences"][seq]["name"];
			var path = evt["options"];
			soundTable += '<div class="sound_row"><div title="' + seqName + '">' + seqName + '</div><div title="' + path + '">' + path + "</div></div>";
		}
	}
	if (soundTable.length > 0) {
		soundTable = '<div class="soundTable">' + soundTable + "</div>";
	}
	
	var has_mouth = false;
	if (g_view_model_data["controllers"].length > 4) {
		var ctl =  g_view_model_data["controllers"][4];
		has_mouth = ctl.bone >= 0 && ctl.start != ctl.end;
	}
	
	var ext_mdl = "No";
	var ext_tex = g_view_model_data["t_model"];
	var ext_anim = g_view_model_data["seq_groups"] > 1;
	if (ext_tex && ext_anim) {
		ext_mdl = "Textures + Sequences";
	} else if (ext_tex) {
		ext_mdl = "Textures";
	} else if (ext_anim) {
		ext_mdl = "Sequences";
	}
	
	var aliases = g_model_data[g_view_model_name]["aliases"];
	if (aliases) {
		aliases = aliases.join("<br>")
	}
	
	popup.getElementsByClassName("polycount")[0].textContent = totalPolys.toLocaleString(undefined);
	popup.getElementsByClassName("polycount")[0].setAttribute("title", totalPolys.toLocaleString(undefined));
	popup.getElementsByClassName("filesize")[0].textContent = humanFileSize(g_view_model_data["size"]);
	popup.getElementsByClassName("filesize")[0].setAttribute("title", humanFileSize(g_view_model_data["size"]));
	popup.getElementsByClassName("compilename")[0].textContent = g_view_model_data["name"];
	popup.getElementsByClassName("compilename")[0].setAttribute("title", g_view_model_data["name"]);
	popup.getElementsByClassName("aliases")[0].innerHTML = aliases ? aliases : "None";
	popup.getElementsByClassName("aliases")[0].setAttribute("title", aliases ? aliases.replaceAll("<br>", "\n") : "This model has no known aliases.");
	popup.getElementsByClassName("ext_mdl")[0].textContent = ext_mdl;
	popup.getElementsByClassName("ext_mdl")[0].setAttribute("title", ext_mdl);
	popup.getElementsByClassName("sounds")[0].innerHTML = soundTable.length > 0 ? soundTable : "None";
	popup.getElementsByClassName("md5")[0].textContent = g_view_model_data["md5"];
	popup.getElementsByClassName("md5")[0].setAttribute("title", g_view_model_data["md5"]);
	popup.getElementsByClassName("has_mouth")[0].textContent = has_mouth ? "Yes" : "No";
	
	var polyColor = "";
	if (totalPolys < 1000) {
		polyColor = "#0f0";
		if (totalPolys < 600) {
			popup.getElementsByClassName("polycount")[0].innerHTML += "&nbsp;&nbsp;👍";
		}
	} else if (totalPolys < 2000) {
		polyColor = "white";
	} else if (totalPolys < 4*1000) {
		polyColor = "yellow";
	} else if (totalPolys < 10*1000) {
		polyColor = "orange";
	} else {
		polyColor = "red";
	}
	
	if (totalPolys >= 60*1000) {
		popup.getElementsByClassName("polyflame")[0].style.visibility = "visible";
	}
	if (totalPolys >= 40*1000) {
		popup.getElementsByClassName("polycount")[0].classList.add("insane");
	}
	if (totalPolys >= 20*1000) {
		popup.getElementsByClassName("polycount")[0].innerHTML = "🚨 "
		+ popup.getElementsByClassName("polycount")[0].innerHTML + " 🚨";
	}
	popup.getElementsByClassName("polycount")[0].style.color = polyColor;
	
}

function view_model(model_name) {
	var model_path = "models/player/" + model_name + "/";
	var popup = document.getElementById("model-popup");
	var popup_bg = document.getElementById("model-popup-bg");
	var img = popup.getElementsByTagName("img")[0];
	var canvas = popup.getElementsByTagName("canvas")[0];
	var details = popup.getElementsByClassName("details")[0];
	var repo_url = get_repo_url(model_name);
	popup.style.display = "block";
	popup_bg.style.display = "block";
	canvas.style.visibility = "hidden";
	img.style.display = "block";
	img.setAttribute("src", "");
	img.setAttribute("src", repo_url + model_path + model_name + "_small.png");
	img.setAttribute("src_large", repo_url + model_path + model_name + "_large.png");
	g_view_model_name = model_name;
	document.getElementById("cl_himodels").checked = true;
	
	popup.getElementsByClassName("details-header")[0].textContent = model_name;
	popup.getElementsByClassName("polycount")[0].textContent = "???";
	popup.getElementsByClassName("polycount")[0].removeAttribute("title");
	popup.getElementsByClassName("filesize")[0].textContent = "???";
	popup.getElementsByClassName("filesize")[0].removeAttribute("title");
	popup.getElementsByClassName("compilename")[0].textContent = "???";
	popup.getElementsByClassName("compilename")[0].removeAttribute("title");
	popup.getElementsByClassName("ext_mdl")[0].textContent = "???";
	popup.getElementsByClassName("ext_mdl")[0].removeAttribute("title");
	popup.getElementsByClassName("sounds")[0].textContent = "???";
	popup.getElementsByClassName("aliases")[0].textContent = "???";
	popup.getElementsByClassName("aliases")[0].removeAttribute("title");
	popup.getElementsByClassName("md5")[0].textContent = "???";
	popup.getElementsByClassName("md5")[0].removeAttribute("title");
	popup.getElementsByClassName("has_mouth")[0].textContent = "???";
	popup.getElementsByClassName("loader")[0].style.visibility = "visible";
	popup.getElementsByClassName("loader-text")[0].style.visibility = "visible";
	popup.getElementsByClassName("loader-text")[0].textContent = "Loading (0%)";
	popup.getElementsByClassName("polycount")[0].style.color = "";
	popup.getElementsByClassName("polycount")[0].classList.remove("insane");
	popup.getElementsByClassName("polyflame")[0].style.visibility = "hidden";
	
	let select = popup.getElementsByClassName("animations")[0];
	select.textContent = "";

	canvas.style.width = "" + renderWidth + "px";
	canvas.style.height = "" + renderHeight + "px";
	img.style.width = "" + renderWidth + "px";
	img.style.height = "" + renderHeight + "px";
	details.style.height = "" + renderHeight + "px";
	
	img.onload = function() {
		img.setAttribute("src", repo_url + model_path + model_name + "_large.png");
		
		img.onload = function() {
			img.onload = undefined;
		};
	}
	
	popup.getElementsByClassName("hd_setting")[0].style.display = "none";
	
	g_model_was_loaded = false;
	fetchJSONFile(repo_url + model_path + model_name + ".json", function(data) {
		console.log(data);
		g_view_model_data = data;
		
		update_model_details();
		
		if (document.getElementById("3d_on").checked) {
			let t_model = data["t_model"] ? model_name + "t.mdl" : "";
			hlms_load_model(model_name, t_model, data["seq_groups"]);
			g_model_was_loaded = true;
		} else {
			popup.getElementsByClassName("loader")[0].style.visibility = "hidden";
			popup.getElementsByClassName("loader-text")[0].style.visibility = "hidden";
			g_model_was_loaded = false;
		}
		
		for (var x = 0; x < data["sequences"].length; x++ ) {
			let seq = document.createElement("option");
			seq.textContent = "" + x + " : " + data["sequences"][x]["name"];
			select.appendChild(seq);
		}
	});
}

function download_model() {	
	var fileList = [
		g_model_path + g_view_model_name + "/" + g_view_model_name + ".bmp",
		g_model_path + g_view_model_name + "/" + g_view_model_name + ".mdl"
	];
	
	for (var i = 0; i < g_view_model_data["seq_groups"]-1; i++) {
		var num = i+1;
		var suffix = i < 10 ? "0" + num : num;
		fileList.push(g_model_path + g_view_model_name + "/" + g_view_model_name + suffix + ".mdl");
	}
	
	if (g_view_model_data["t_model"]) {
		fileList.push(g_model_path + g_view_model_name + "/" + g_view_model_name + "t.mdl");
	}
	
	var fileData = {};	
	for (var i = 0; i < fileList.length; i++) {
		(function(path) {
			console.log("Downloading: " + path);
			
			fetchBinaryFile(get_repo_url + path, function(data) {
				fileData[path] = data;
				console.log("Downloaded " + path);
			});
		})(fileList[i]);
	}
	
	var interval = setInterval(function() {
		console.log("Waiting for file downloads... " + Object.keys(fileData).length + " / " + fileList.length);
		
		if (Object.keys(fileData).length >= fileList.length) {
			console.log("FINISHED!");
			clearInterval(interval);
			
			var zip = new JSZip();
			
			for (var key in fileData) {
				zip.file(key, fileData[key]);
			}
			
			zip.generateAsync({type:"blob"}).then(function(content) {
				saveAs(content, g_view_model_name + ".zip");
			});
		}
	}, 100);
	
}

function close_model_viewer() {
	var popup = document.getElementById("model-popup");
	var popup_bg = document.getElementById("model-popup-bg");
	popup.style.display = "none";
	popup_bg.style.display = "none";
	
	if (can_load_new_model) {
		Module.ccall('unload_model', null, [], [], {async: true});
	} else {
		model_unload_waiting = true;
	}
}

function hlms_do_queued_action() {
	if (model_load_queue) {
		if (hlms_load_model(model_load_queue)) {
			model_load_queue = undefined;
			model_unload_waiting = false;
		}
	} else if (model_unload_waiting) {
		Module.ccall('unload_model', null, [], [], {async: true});
		model_unload_waiting = false;
	}
}

function hlms_model_load_complete(successful) {
	if (successful) {
		var popup = document.getElementById("model-popup");
		var img = popup.getElementsByTagName("img")[0];
		var canvas = popup.getElementsByTagName("canvas")[0];
		
		if (document.getElementById("3d_on").checked) {
			canvas.style.visibility = "visible";
			img.style.display = "none";
			img.setAttribute("src", "");
			Module.ccall('set_wireframe', null, ["number"], [document.getElementById("wireframe").checked ? 1 : 0], {async: true});
		}
		
		popup.getElementsByClassName("loader")[0].style.visibility = "hidden";
		popup.getElementsByClassName("loader-text")[0].style.visibility = "hidden";
		
		console.log("Model loading finished");
	} else {
		console.log("Model loading failed");
	}
	
	can_load_new_model = true;
	setTimeout(function() {
		hlms_do_queued_action();
	}, 100);
}

function hlms_ready() {
	can_load_new_model = true;
	hlms_is_ready = true;
	console.log("Model viewer is ready");
	hlms_do_queued_action();
	
	// GLFW will disable backspace and enter otherwise (WTF?)
	window.removeEventListener("keydown", GLFW.onKeydown, true);
	window.addEventListener("keydown", function() {
		GLFW.onKeyChanged(event.keyCode, 1); // GLFW_PRESS or GLFW_REPEAT
	}, true);
	
	Module.ccall('update_viewport', null, ['number', 'number'], [renderWidth*antialias, renderHeight*antialias], {async: true});
}

function load_page() {
	stopDownloads();
	
	document.getElementsByClassName("result-total")[0].textContent = "" + model_results.length;
	document.getElementsByClassName("page-start")[0].textContent = "" + (result_offset+1);
	document.getElementsByClassName("page-end")[0].textContent = "" + Math.min(result_offset+results_per_page, model_results.length);
	
	update_model_grid();
}

function next_page() {
	result_offset += results_per_page;
	if (result_offset >= model_results.length) {
		result_offset -= results_per_page;
		return;
	}
	load_page();
}

function prev_page() {
	result_offset -= results_per_page;
	if (result_offset < 0) {
		result_offset = 0;
	}
	load_page();
}

function first_page() {
	result_offset = 0;
	load_page();
}

function last_page() {
	result_offset = 0;
	while (true) {
		result_offset += results_per_page;
		if (result_offset >= model_results.length) {
			result_offset -= results_per_page;
			break;
		}
	}
	load_page();
}

function load_results() {
	first_page();
}

function apply_filters(no_reload) {
	var name_filter = document.getElementById("name-filter").value;
	var tag_filter = document.getElementsByClassName("categories")[0].value.toLowerCase();
	var hide_old_ver = document.getElementById("filter_ver").checked;
	var use_groups = document.getElementById("filter_group").checked;
	var sort_by = document.getElementsByClassName("sort")[0].value.toLowerCase();
	
	console.log("Applying filters");
	
	var blacklist = {};
	
	g_groups_with_results = {};
	
	var name_parts = [];
	if (name_filter.length > 0 && Object.keys(g_model_data).length > 0) {
		name_parts = name_filter.toLowerCase().split(" ");
	}
	var is_tag_filtering = tag_filter.length > 0 && tag_filter != "all";
	var show_group_matches = (name_parts.length > 0 || is_tag_filtering) && g_group_filter.length == 0;
	
	for (var i = 0; i < g_model_names.length; i++) {
		var modelName = g_model_names[i];
		var group = g_model_data[modelName]["group"];
		var shouldExclude = false;
		
		if (g_group_filter.length) {
			if (group != g_group_filter) {
				shouldExclude = true;
			}
		}
		
		if (!shouldExclude && is_tag_filtering) {
			if (!(g_model_data[modelName]["tags"]) || !g_model_data[modelName]["tags"].has(tag_filter)) {
				shouldExclude = true;
			}
		}
		
		if (!shouldExclude && hide_old_ver) {
			if (modelName in g_old_versions) {
				var is_group = false;
				for (var key in g_groups) {
					if (g_groups[key][0] == modelName) {
						is_group = true;
						break;
					}
				}
				
				if (!use_groups || !is_group) {
					shouldExclude = true;
				}
			}
		}
		
		if (!shouldExclude && name_parts.length > 0) {		
			var aliases = [modelName];
			if (g_model_data[modelName]["aliases"]) {
				aliases = aliases.concat(g_model_data[modelName]["aliases"]);
			}
			
			var anyMatch = false;
			for (var a = 0; a < aliases.length; a++) {
				var testName = aliases[a].toLowerCase();
				
				var aliasMatched = true;
				for (var k = 0; k < name_parts.length; k++) {					
					// TODO: Add this when it's clear that a result is shown because the group name matches:
					//       !(group && group.toLowerCase().includes(name_parts[k]))
					
					if (!testName.includes(name_parts[k])) {
						aliasMatched = false;
						break;
					}
				}
				
				if (aliasMatched) {
					anyMatch = true;
					break;
				}
			}
			
			if (!anyMatch) {
				shouldExclude = true;
			}
		}
		
		if (shouldExclude) {
			blacklist[g_model_names[i]] = true;
		}
		else if (show_group_matches && group) {
			g_groups_with_results[group] = g_groups_with_results[group] ? g_groups_with_results[group] + 1 : 1;
		}
	}
	
	// remove models that are in groups, unless it's the first model or if any grouped models matched the search terms
	if (use_groups) {
		for (var key in g_groups) {
			if (key == g_group_filter) {
				continue;
			}
			for (var i = 1; i < g_groups[key].length; i++) {
				blacklist[g_groups[key][i]] = true;
			}
			if (g_groups_with_results[key]) {
				blacklist[g_groups[key][0]] = false;
			}
		}
	}
	
	model_results = g_model_names.filter(function (name) {
		return !(blacklist[name]);
	});
	
	if (sort_by != "name") {		
		if (sort_by == "polys") {
			model_results.sort(function(x, y) {
				return g_model_data[y].polys - g_model_data[x].polys;
			});
		} else if (sort_by == "size") {
			model_results.sort(function(x, y) {
				return g_model_data[y].size - g_model_data[x].size;
			});
		}
	}
	
	if (no_reload === true) {
		load_page();
	} else {
		load_results();
	}
}

var last_text = "";

function update_model_grid() {
	var total_models = g_model_names.length;
	var grid = document.getElementById("model-grid");
	var cell_template = document.getElementById("model-cell-template");
	var hide_old_ver = document.getElementById("filter_ver").checked && Object.keys(g_model_data).length > 0;
	var group_mode = document.getElementById("filter_group").checked;
	var is_searching = Object.keys(g_groups_with_results).length > 0;
	
	grid.innerHTML = "";
	
	var total_cells = 0;
	var idx = 0;
	model_results.every(function(model_name) {
		//console.log("Loading model: " + model_name);
		
		idx += 1;
		if (idx <= result_offset) {
			return true;
		}
		
		let group_name = Object.keys(g_model_data).length > 0 ? g_model_data[model_name].group : undefined;
		let is_group = group_mode
						&& group_name
						&& group_name in g_groups
						&& g_groups[group_name][0] == model_name
						&& g_group_filter != group_name;
						
		var total_in_group = 0;
		if (is_group) {
			for (var i = 0; i < g_groups[group_name].length; i++) {
				var testName = g_groups[group_name][i];
				var baseName = get_model_base_name(testName);
				if (!hide_old_ver || !g_old_versions[testName]) {
					total_in_group += 1;
				}
			}
			if (total_in_group <= 1) {
				is_group = false;
			}
		}
 		
		var cell = cell_template.cloneNode(true);
		var img = cell.getElementsByTagName("img")[0];
		var name = cell.getElementsByClassName("name")[0];
		var repo_url = get_repo_url(model_name);
		cell.setAttribute("class", "model-cell");
		cell.removeAttribute("id");
		img.setAttribute("src", repo_url + "models/player/" + model_name + "/" + model_name + "_small.png");
		
		if (is_group) {
			var group_count = cell.getElementsByClassName("model-group-count")[0];
			
			if (is_searching) {
				group_count.textContent = "" + g_groups_with_results[group_name] + " / " + total_in_group + " match";
			} else {
				group_count.textContent = "" + total_in_group + " models";
			}
			
			group_count.classList.remove("hidden");
		}
		
		img.addEventListener("click", function() {
			if (is_group) {
				g_group_filter = group_name;
				g_offset_before_group = result_offset;
				g_search_before_group = document.getElementById("name-filter").value;
				document.getElementById("group-banner").classList.remove("hidden");
				document.getElementsByClassName("groupname")[0].textContent = group_name;
				apply_filters();
			} else {
				view_model(model_name);
			}
		});
		name.innerHTML = model_name;
		name.setAttribute("title", model_name);
		
		
		name.addEventListener("mousedown", function(event) { 
			
			var oldText = event.target.textContent;
			if (oldText == "Copied!") {
				return; // don't copy the user message
			}
			
			event.target.textContent = oldText;
			
			// debug
			if (g_debug_mode) {
				if (g_debug_copy.length) {
					g_debug_copy += ',\n\t\t"' + oldText + '"';
				} else {
					g_debug_copy += '"' + oldText + '"';
				}
				copyStringWithNewLineToClipBoard(g_debug_copy);
			}
			else {
				window.getSelection().selectAllChildren(event.target);
				document.execCommand("copy");
			}
			
			event.target.textContent = "Copied!";
			
			setTimeout(function() {
				event.target.textContent = oldText;
			}, 800);
		} );
		grid.appendChild(cell);
		
		total_cells += 1;
		return total_cells < results_per_page;
	});
}

function copyStringWithNewLineToClipBoard(stringWithNewLines){
	console.log("COPY THIS " + stringWithNewLines)
    // Step3: find an id element within the body to append your myFluffyTextarea there temporarily
    const element = document.getElementsByClassName("debug")[0];
	element.innerHTML = stringWithNewLines;
    
    // Step 4: Simulate selection of your text from myFluffyTextarea programmatically 
    element.select();
    
    // Step 5: simulate copy command (ctrl+c)
    // now your string with newlines should be copied to your clipboard 
    document.execCommand('copy');
}

function get_repo_url(model_name) {
	var repoId = hash_code(model_name) % data_repo_count;
	
	return data_repo_domain + "scmodels_data_" + repoId + "/";
}

function hash_code(str) {
	var hash = 0;

	for (var i = 0; i < str.length; i++) {
		var char = str.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash % 15485863; // prevent hash ever increasing beyond 31 bits

	}
	return hash;
}

function set_animation(idx) {
	Module.ccall('set_animation', null, ['number'], [idx], {async: true});
}

function reset_zoom(idx) {
	Module.ccall('reset_zoom', null, [], [], {async: true});
}

window.onresize = handle_resize;

function handle_resize(event) {	
	var gridWidth = document.getElementById("model-grid").offsetWidth;
	var pagingHeight = document.getElementsByClassName("page-num-container")[0].offsetHeight;
	
	var iconsPerRow = Math.floor( gridWidth / 145 );
	var iconsPerCol = Math.floor( (window.innerHeight - pagingHeight) / 239 );
	
	if (iconsPerCol < 1)
		iconsPerCol = 1;
	if (iconsPerRow < 1)
		iconsPerRow = 1;
	
	results_per_page = iconsPerRow*iconsPerCol;
	
	load_page();
	
	renderHeight = Math.floor( Math.max(100, window.innerHeight - 100) );
	renderWidth = Math.floor( renderHeight * (500.0 / 800.0) );
	
	var maxCanvasWidth = window.innerWidth*0.4; // need some space for model details
	if (renderWidth > maxCanvasWidth) {
		renderWidth = maxCanvasWidth;
		renderHeight = Math.floor( renderWidth * (800.0 / 500.0) );
	}
	
	var popup = document.getElementById("model-popup");
	var img = popup.getElementsByTagName("img")[0];
	var canvas = popup.getElementsByTagName("canvas")[0];
	var details = popup.getElementsByClassName("details")[0];
	
	if (hlms_is_ready)
		Module.ccall('update_viewport', null, ['number', 'number'], [renderWidth*antialias, renderHeight*antialias], {async: true});
	
	canvas.style.width = "" + renderWidth + "px";
	canvas.style.height = "" + renderHeight + "px";
	img.style.width = "" + renderWidth + "px";
	img.style.height = "" + renderHeight + "px";
	details.style.width = "calc(100% - " + renderWidth + "px)";
	details.style.height = "" + renderHeight + "px";
};

function handle_3d_toggle() {
	var popup = document.getElementById("model-popup");
	var img = popup.getElementsByTagName("img")[0];
	var canvas = popup.getElementsByTagName("canvas")[0];
	
	if (g_3d_enabled) {
		canvas.style.visibility = "visible";
		img.style.display = "none";
		img.setAttribute("src", "");
		
		Module.ccall('pause', null, ["number"], [0], {async: true});
		if (!g_model_was_loaded) {
			view_model(g_view_model_name);
		}
	} else {
		canvas.style.visibility = "hidden";
		img.style.display = "block";
		img.setAttribute("src", img.getAttribute("src_large"));
		
		Module.ccall('pause', null, ["number"], [1], {async: true});
	}
}

function get_model_base_name(name) {
	var ver_regex = /_v\d+$/g;
	var verSuffix = name.match(ver_regex);
	
	if (verSuffix) {
		return name.replace(verSuffix[0], "");
	}
	
	return name;
}

function json_post_load() {
	document.getElementsByClassName("content")[0].classList.remove("hidden");
	document.getElementsByClassName("site-loader")[0].classList.add("hidden");
	
	if (g_debug_mode) {
		document.getElementsByClassName("debug")[0].classList.remove("hidden");
	}
	
	// process group info
	for (var key in g_groups) {
		for (var i = 0; i < g_groups[key].length; i++) {
			var name = g_groups[key][i];
			if (name in g_model_data) {
				if (g_model_data[name]["group"]) {
					if (g_model_data[name]["group"] != key) {
						console.error(name + " is in group '" + g_model_data[name]["group"] + "' AND '" + key + "'");
					} else {
						console.error(name + " is in group '" + g_model_data[name]["group"] + "' more than once");
					}
				}
				g_model_data[name]["group"] = key;
			} else {
				console.error("MISSING MODEL: " + name + " in group " + key);
			}
		}
	}
	
	// process tag info
	var categories = document.getElementsByClassName("categories")[0];
	for (var tag in g_tags) {
		let opt = document.createElement("option");
		opt.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
		categories.appendChild(opt);
		
		for (var i = 0; i < g_tags[tag].length; i++) {
			var model = g_tags[tag][i];
			
			if (!("tags" in g_model_data[model])) {
				g_model_data[model]["tags"] = new Set();
			}
			
			g_model_data[model]["tags"].add(tag);
		}
	}
	
	// process version info
	for (var i = 0; i < g_versions.length; i++) {
		// skip first value of the list, which is the latest version
		var latest_version = g_versions[i][0];
		
		for (var k = 1; k < g_versions[i].length; k++) {
			var modelName = g_versions[i][k];
			g_old_versions[modelName] = true;
			var parentGroup = g_model_data[latest_version]["group"];
			
			// inherit group/tag info from latest version
			if (parentGroup) {
				g_groups[parentGroup].push(modelName);
				g_model_data[modelName]["group"] = g_model_data[latest_version]["group"];
			} else {
				var newGroupName = get_model_base_name(modelName);
				g_groups[newGroupName] = [latest_version, modelName];
				g_model_data[modelName]["group"] = g_model_data[latest_version]["group"] = newGroupName;
			}
			
			if (g_model_data[latest_version]["tags"]) {
				g_model_data[modelName]["tags"] = new Set(g_model_data[latest_version]["tags"]);
			}
		}
	}
	
	console.log("NEW GROUP: ", g_groups);
	
	// process alias info
	for (var key in g_aliases) {
		if (!g_model_data[key]) {
			console.error("Aliases for unknown model: " + key);
			continue;
		}
		g_model_data[key]["aliases"] = g_aliases[key];
	}
	
	// make sure the sort keys exist
	for (var key in g_model_data) {
		g_model_data[key]['polys'] = g_model_data[key]['polys'] || -1;
		g_model_data[key]['size'] = g_model_data[key]['size'] || -1;
	}
	
	apply_filters();
	handle_resize();
}

function wait_for_json_to_load() {
	if (g_db_files_loaded < 6) {
		setTimeout(function() {
			wait_for_json_to_load();
		}, 10);
	} else {
		console.log("All json files loaded. Time to process them.");
		json_post_load();
	}
}

function load_database_files() {
	fetchTextFile("model_names.txt", function(data) {
		g_model_names = data.split("\n");
		g_model_names = g_model_names.filter(function (name) {
			return name.length > 0;
		});
		
		console.log("loaded " + g_model_names.length + " model names");
		
		g_model_names.sort(function(x, y) {
			if (x.toLowerCase() < y.toLowerCase()) {
				return -1;
			}
			return 1;
		});
		
		
		//model_results = g_model_names;
		//apply_filters();
		//handle_resize();
		
		g_db_files_loaded += 1;
	});
	
	fetchJSONFile("models.json", function(data) {
		console.log("Global model data: ", data);
		g_model_data = data;
		g_db_files_loaded += 1;
	});
	
	fetchJSONFile("versions.json", function(versions) {
		console.log("Version info: ", versions);
		g_versions = versions;
		g_db_files_loaded += 1;
	});
	
	fetchJSONFile("tags.json", function(tags) {
		console.log("Tag info: ", tags);
		g_tags = tags;
		g_db_files_loaded += 1;
	});
	
	fetchJSONFile("groups.json", function(data) {
		console.log("Group data (from server): ", data);
		g_groups = data;
		g_db_files_loaded += 1;
	});
	
	fetchJSONFile("alias.json", function(data) {
		console.log("Aliases: ", data);
		g_aliases = data;
		g_db_files_loaded += 1;
	});
	
	wait_for_json_to_load();
}

document.addEventListener("DOMContentLoaded",function() {
	load_database_files();
	
	document.getElementById("model-popup-bg").addEventListener("click", close_model_viewer);
	document.getElementsByClassName("page-next-container")[0].addEventListener("click", next_page);
	document.getElementsByClassName("page-prev-container")[0].addEventListener("click", prev_page);
	document.getElementsByClassName("page-first-container")[0].addEventListener("click", first_page);
	document.getElementsByClassName("page-last-container")[0].addEventListener("click", last_page);
	document.getElementsByClassName("download-but")[0].addEventListener("click", download_model);
	document.getElementById("name-filter").addEventListener("keyup", apply_filters);
	document.getElementsByClassName('categories')[0].onchange = function() {
		apply_filters();
	};
	document.getElementsByClassName('sort')[0].onchange = function() {
		apply_filters();
	}
	document.getElementsByClassName('animations')[0].onchange = function() {
		set_animation(this.selectedIndex);
	};
	document.getElementById("3d_on").onchange = function() {
		g_3d_enabled = this.checked;
		handle_3d_toggle();
	};
	document.getElementById("cl_himodels").onchange = function() {
		let body = this.checked ? 255 : 0;
		Module.ccall('set_body', null, ["number"], [body], {async: true});
		update_model_details();
	};
	document.getElementById("wireframe").onchange = function() {
		Module.ccall('set_wireframe', null, ["number"], [this.checked ? 1 : 0], {async: true});
	};
	document.getElementById("filter_ver").onchange = function() {
		var use_groups = document.getElementById("filter_group").checked;
		apply_filters(use_groups && g_group_filter.length == 0);
	};
	document.getElementById("filter_group").onchange = function() {
		apply_filters();
	};
	document.getElementsByClassName("group-back")[0].addEventListener("click", function() {
		g_group_filter = "";
		document.getElementById("group-banner").classList.add("hidden");
		document.getElementById("name-filter").value = g_search_before_group;
		apply_filters();
		
		result_offset = g_offset_before_group;
		load_page();
	});
	
	if (g_debug_mode) {
		document.onkeypress = function (e) {
			e = e || window.event;
			g_debug_copy = "";
			console.log("CLEARED DEBUG COPY");
		};
	}
	
});
