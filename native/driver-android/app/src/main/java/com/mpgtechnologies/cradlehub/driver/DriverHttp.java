package com.mpgtechnologies.cradlehub.driver;
import org.json.JSONObject;
/** Bounded native transport response shared with the retained Navigation SDK controller. */
public final class DriverHttp {
  private DriverHttp() {}
  public static final class Reply {
    public final int status;
    public final JSONObject body;
    Reply(int status, JSONObject body) { this.status = status; this.body = body; }
  }
}
