import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/notes/:path*",
    "/api/connections/:path*",
    "/api/search/:path*",
    "/api/upload/:path*",
  ],
};
