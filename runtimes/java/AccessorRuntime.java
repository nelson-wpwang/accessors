import java.lang.String;
import javax.script.*;
import java.net.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.*;
import java.util.List;
import java.util.ArrayList;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.DocumentBuilder;
import org.w3c.dom.CharacterData;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.w3c.dom.Node;
import org.w3c.dom.Element;

public class AccessorRuntime {
	public static void main(String[] args) throws Exception {
		String server_host = null;
		String location = null;

		// Parse Arguments
		for (int i = 0; i < args.length; i++) {
			if (args[i].charAt(0) != '-') {
				System.out.println("Arguments must start with '-'");
				System.out.println("Bad args: >>>" + args[i].toString() + "<<<");
				usage(1);
			}

			if (i+1 >= args.length) {
				System.out.println("Argument " + args[i].toString() + " requires an argument");
				usage(1);
			}

			if (args[i].equals("-s") || args[i].equals("--accessor-server")) {
				server_host = args[i+1];
				i += 1;
			} else if (args[i].equals("-l") || args[i].equals("--location")) {
				location = args[i+1];
				i += 1;
			} else {
				System.out.println("Unknown argument: " + args[i].toString());
				usage(1);
			}
		}

		if (server_host == null) {
			System.out.println("ERROR: Missing required argument `server_host`");
			usage(1);
		} else if (location == null) {
			System.out.println("ERROR: Missing required argument `location`");
			System.out.println("");
			System.out.println("Need to write a location server, until then try one");
			System.out.println("of the known locations:");
			System.out.println("");
			System.out.println("\tAnywhere");
			System.out.println("\t/");
			System.out.println("");
			System.out.println("\tUniversity of Michigan - 4908 BBB");
			System.out.println("\t/usa/michigan/annarbor/universityofmichigan/bbb/4908/");
			System.out.println("");
			usage(1);
		}

		// Get accessor list for location
		URL loc_url = new URL(server_host + "/accessors" + location + "accessors.xml");
		System.out.println("GET " + loc_url.toString());
		HttpURLConnection urlConnection = (HttpURLConnection) loc_url.openConnection();
		Document root_doc;
		try {
			int responseCode = urlConnection.getResponseCode();
			if (responseCode != urlConnection.HTTP_OK) {
				System.out.println("Attempted request for " + loc_url.toString());
				System.out.println("Error connecting to URL. Exiting.");
				System.exit(2);
			}

			DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
			DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
			root_doc = dBuilder.parse(loc_url.openStream());
		} finally {
			urlConnection.disconnect();
		}

		root_doc.getDocumentElement().normalize();

		// Get all of the accessors from that location
		List<Document> accessors_array = new ArrayList<Document>();
		NodeList nList = root_doc.getElementsByTagName("accessor");
		for (int i = 0; i < nList.getLength(); i++) {
			Node nNode = nList.item(i);
			String accessor_url = nNode.getTextContent();

			int idx = accessor_url.indexOf("?");
			if (idx == -1) {
				accessor_url += ".xml?_language=traceur_es5";
			} else {
				// Ugh, really Java? Every other runtime will do this for me
				String root = accessor_url.substring(0, idx);
				String params = accessor_url.substring(idx+1);
				accessor_url =  root + ".xml?";
				String rest;
				//System.out.println("--------------------");
				do {
					//System.out.println("accessor_url: " + accessor_url);
					//System.out.println("      params: " + params + "\n");
					int eidx = params.indexOf("=");
					int sidx = params.indexOf("&");
					String param = params.substring(0, eidx);
					String value;
					if (sidx != -1) {
						value = params.substring(eidx+1, sidx);
						params = params.substring(sidx+1);
					} else {
						value = params.substring(eidx+1);
						params = "";
					}

					accessor_url += URLEncoder.encode(param, "UTF-8");
					accessor_url += "=";
					accessor_url += URLEncoder.encode(value, "UTF-8");
					if (sidx != -1) {
						accessor_url += "&";
					}
				} while (params.length() > 0);
				//System.out.println("accessor_url: " + accessor_url);
				accessor_url += "&_language=traceur_es5";
			}

			URL get_url = new URL(server_host + "/accessor" + accessor_url);
			System.out.println("GET " + get_url.toString());

			HttpURLConnection get_url_connection = (HttpURLConnection) get_url.openConnection();
			try {
				int responseCode = get_url_connection.getResponseCode();
				if (responseCode != get_url_connection.HTTP_OK) {
					System.out.println("Attempted request for " + get_url.toString());
					System.out.println("Error GET-ing URL. Exiting.");
					System.exit(2);
				}

				DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
				DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
				Document doc = dBuilder.parse(get_url.openStream());
				doc.getDocumentElement().normalize();

				accessors_array.add(doc);
			} finally {
				get_url_connection.disconnect();
			}
		}

		Document [] accessors = accessors_array.toArray( new Document[ accessors_array.size() ]);

		System.out.println("Accessors: ");
		for (int i = 0; i < accessors.length; i++) {
			Element eElement = (Element) accessors[i].getDocumentElement();
			System.out.println("\t" + eElement.getAttribute("name"));
		}

		Element hue_single_element = null;
		for (int i = 0; i < accessors.length; i++) {
			hue_single_element = (Element) accessors[i].getDocumentElement();
			if (hue_single_element.getAttribute("name").equals("Hue Single")) {
				System.out.println("Got Hue Single");
				break;
			}
		}

		if (!hue_single_element.getAttribute("name").equals("Hue Single")) {
			System.exit(1);
		}

		// create a script engine manager
		ScriptEngineManager factory = new ScriptEngineManager();
		// create JavaScript engine
		ScriptEngine engine = factory.getEngineByName("nashorn");

		if (engine == null) {
			System.out.println("Failed to get nashorn engine. Dying.");
			System.out.println("(Are you running Java 8?)");
			System.exit(1);
		}

		// Initialize traceur runtime
		engine.eval(new java.io.FileReader("bower_components/traceur-runtime/traceur-runtime.js"));

		// Initialize the accessor runtime
		engine.eval("version = Packages.AccessorRuntime.version");
		// TODO subinit
		// TODO log
		// TODO time

		engine.eval("get = Packages.AccessorRuntime.get");
		engine.eval("set = Packages.AccessorRuntime.set");
		engine.eval("get_parameter = Packages.AccessorRuntime.get_parameter");

		// TODO socket

		engine.eval("http = Object()");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; var o = Object(); http.request = $traceurRuntime.initGeneratorFunction(function $__0(url, method) { var properties, body, timeout; var $arguments = arguments; return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: properties = $arguments[2] !== (void 0) ? $arguments[2] : null; body = $arguments[3] !== (void 0) ? $arguments[3] : null; timeout = $arguments[4] !== (void 0) ? $arguments[4] : null; $ctx.state = 4; break; case 4: $ctx.returnValue = Packages.AccessorRuntime.http_request(url, method, properties, body, timeout); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");
		engine.eval("$traceurRuntime.ModuleStore.getAnonymousModule(function() { 'use strict'; http.readURL = $traceurRuntime.initGeneratorFunction(function $__0(url) { return $traceurRuntime.createGeneratorInstance(function($ctx) { while (true) switch ($ctx.state) { case 0: $ctx.returnValue = Packages.AccessorRuntime.http_readURL(url); $ctx.state = -2; break; default: return $ctx.end(); } }, $__0, this); }); return {}; });");

		// TODO color

		// Load accessor code
		NodeList script = hue_single_element.getElementsByTagName("script");
		Element wtf = (Element) script.item(0);
		String code = getCharacterDataFromElement(wtf);
		//System.out.println("Script: " + code);
		engine.eval(code);

		// Call accessor init
		System.out.println("Initializing accessor...");
		// TODO: Handle init vs init*
		engine.eval("init().next()");

		// Turn on a fucking light
		System.out.println("Setting power on");
		engine.eval("Power(true).next()");
		Thread.sleep(2000);

		System.out.println("Setting power off");
		engine.eval("Power(false).next()");
		Thread.sleep(2000);

		System.out.println("Setting power on");
		engine.eval("Power(true).next()");

		System.out.println("\n\nDone. Goodbye.");
	}

	// http://stackoverflow.com/questions/11553697/
	public static String getCharacterDataFromElement(Element e) {
		NodeList list = e.getChildNodes();
		String data;

		for (int i = 0; i < list.getLength(); i++) {
			if (list.item(i) instanceof CharacterData) {
				CharacterData child = (CharacterData) list.item(i);
				data = child.getData();

				if (data != null && data.trim().length() > 0) {
					return child.getData();
				}
			}
		}
		System.out.println("WARN: Request CDATA from not CDATA element");
		return "";
	}

	// http://stackoverflow.com/questions/326390/
	static String readFile(String path) throws IOException {
		byte[] encoded = Files.readAllBytes(Paths.get(path));
		return new String(encoded);
	}

	public static void usage(int retcode) {
		System.out.println("");
		System.out.println("USAGE: java AccessorRuntime -s ACCESSOR_SERVER -l LOCATION");
		System.out.println("");
		System.out.println("  -s, --accessor-server    URL of accessor server");
		System.out.println("  -l, --location           Path for accessor locations");
		System.out.println("");

		System.exit(retcode);
	}

	// ACCESSOR RUNTIME
	//
	// ### GENERAL UTILITY
	public static String version() {
		return "0.1.0";
	}
	public static String version(String set_to) {
		if (!set_to.equals("0.1.0")) {
			System.out.println("Request for runtime version " + set_to + " ignored.");
		}
		return version();
	}

	// TODO polymorphic return type?
	public static String get(String port_name) {
		System.out.println("runtime: get(" + port_name + ")");
		if (port_name.equals("BulbName")) {
			return "Pat";
		}
		System.out.println("hack fail on get");
		System.exit(1);
		return "";
	}

	// TODO polymorphic set value?
	public static void set(String port_name, String value) {
		System.out.println("runtime: set(" + port_name + "," + value + ")");
	}

	public static String get_parameter(String parameter_name) {
		if (parameter_name.equals("bridge_url"))
			return "http://4908hue.eecs.umich.edu";
		if (parameter_name.equals("username"))
			return "lab11in4908";
		return "XXX_ERROR";
	}


	// ### HTTP REQUESTS
	public static String http_request(String url_str, String method, String properties, String body, int timeout) throws Exception {
		// http://stackoverflow.com/questions/1051004/
		URL url = new URL(url_str);
		HttpURLConnection httpCon = (HttpURLConnection) url.openConnection();
		httpCon.setDoOutput(true);
		httpCon.setRequestMethod(method);
		OutputStreamWriter out = new OutputStreamWriter( httpCon.getOutputStream());
		out.write(body);
		out.close();
		String resp = URLConnectionReader.getTextFromStream(httpCon.getInputStream());
		System.out.println("runtime: http_request(" + url + ", ...) => " + resp);
		return resp;
	}

	public static String http_readURL(String url) throws Exception {
		String resp = URLConnectionReader.getText(url);
		System.out.println("runtime: http_readURL(" + url + ") => " + resp);
		return resp;
	}
}

// http://stackoverflow.com/questions/4328711/
class URLConnectionReader {
	public static String getText(String url) throws Exception {
		URL website = new URL(url);
		URLConnection connection = website.openConnection();
		return getTextFromStream(connection.getInputStream());
	}

	public static String getTextFromStream(InputStream is) throws Exception {
		BufferedReader in = new BufferedReader(
				new InputStreamReader(is));

		StringBuilder response = new StringBuilder();
		String inputLine;

		while ((inputLine = in.readLine()) != null)
			response.append(inputLine);

		in.close();

		return response.toString();
	}
}
