// vim: set ts=2 sts=2 sw=2 noet:

public class Stock {
	public static void main(String[] cmd_line) throws Exception {
		Log log = Log.GetLog("Stock");

		log.Debug("Parse args");
		Arguments args = new Arguments(cmd_line);
		args.accessor = "StockTick";
		args.url = "/webquery/StockTick";

		log.Info("Getting accessor for " + args.accessor);
		//Log accessorLog = Log.GetLog("AccessorRuntime");
		//accessorLog.level = accessorLog.DEBUG;
		AccessorRuntime stockTick = new AccessorRuntime(args);

		stockTick.setPort("StockSymbol", "MSFT");
		stockTick.firePort("StockSymbol");
		System.out.println(
				"Stock " + stockTick.getPort("StockSymbol") +
				" price " + stockTick.getPort("Price").toString());

		stockTick.setPort("StockSymbol", "GOOG");
		stockTick.fire();
		System.out.println(
				"Stock " + stockTick.getPort("StockSymbol") +
				" price " + stockTick.getPort("Price").toString());

		stockTick.setAndFirePort("StockSymbol", "YHOO");
		System.out.println(
				"Stock " + stockTick.getPort("StockSymbol") +
				" price " + stockTick.getPort("Price").toString());

		log.Info("Done. Goodbye.");
	}
}

