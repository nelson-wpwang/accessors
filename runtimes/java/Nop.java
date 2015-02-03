// vim: set ts=2 sts=2 sw=2 noet:

public class Nop {
	public static void main(String[] cmd_line) throws Exception {
		//Log log = Log.GetLog("Stock");
		long t1 = System.nanoTime();
		System.out.println("Start: " + t1 + " 0");

		Arguments args = new Arguments(cmd_line);
		args.accessor = "Nop";
		args.url = "/webquery/Nop";

		//log.Info("Getting accessor for " + args.accessor);
		//Log accessorLog = Log.GetLog("AccessorRuntime");
		//accessorLog.level = accessorLog.DEBUG;
		AccessorRuntime stockTick = new AccessorRuntime(args);
		long t2 = System.nanoTime();
		System.out.println("LoadAccessor: " + t2 + " " + (t2-t1));

		/*
		stockTick.setPort("StockSymbol", "MSFT");
		stockTick.firePort("StockSymbol");
		System.out.println(
				"Stock " + stockTick.getPort("StockSymbol") +
				" price " + stockTick.getPort("Price").toString());
		*/

		stockTick.init();
		long t3 = System.nanoTime();
		System.out.println("Init: " + t3 + " " + (t3-t2));

		stockTick.setAndFirePort("StockSymbol", "2");
		long t4 = System.nanoTime();
		System.out.println("Query2: " + t4 + " " + (t4-t3));

		stockTick.setAndFirePort("StockSymbol", "3");
		long t5 = System.nanoTime();
		System.out.println("Query3: " + t5 + " " + (t5-t4));

		stockTick.setAndFirePort("StockSymbol", "4");
		long t6 = System.nanoTime();
		System.out.println("Query4: " + t6 + " " + (t6-t5));

		//log.Info("Done. Goodbye.");
	}
}

