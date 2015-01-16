// vim: set ts=2 sts=2 sw=2 noet:

public class Arguments {
	String server_host = "http://localhost:6565";
	String location = "/usa/michigan/annarbor/universityofmichigan/bbb/4908/";
	String accessor = "XXX_UNDEFINED_XXX"; // TODO: I think I can write a property getter that traps this?
	String url = "XXX_TEMP_XXX"; // TODO: need to un-break lookup

	Arguments(String[] args) {
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
}
