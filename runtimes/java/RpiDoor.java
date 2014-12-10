// vim: set ts=2 sts=2 sw=2 noet:

public class RpiDoor {
	public static void main(String[] cmd_line) throws Exception {
		Log log = Log.GetLog("RpiDoor");

		log.Debug("Parse args");
		Arguments args = new Arguments(cmd_line);
		args.accessor = "Raspberry Pi Door";

		log.Info("Getting accessor for " + args.accessor);
		//Log accessorLog = Log.GetLog("AccessorRuntime");
		//accessorLog.level = accessorLog.DEBUG;
		AccessorRuntime rpiDoor = new AccessorRuntime(args);

		rpiDoor.setAndFirePort("Lock", false);

		log.Info("Done. Goodbye.");
	}
}

