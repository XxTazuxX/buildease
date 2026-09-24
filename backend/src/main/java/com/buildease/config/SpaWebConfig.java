package com.buildease.config;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the bundled React build from classpath:/static and forwards any unmatched, non-/api GET
 * request that looks like a client-side route (no file extension) to index.html, so React Router
 * handles deep links and browser refreshes. /api/** is never touched here; real 404s for missing
 * static files (paths with a file extension) are preserved. When the app is run without the
 * frontend having been bundled in (no classpath:/static/index.html), this degrades to normal 404s,
 * so it has no effect on the backend-only dev workflow.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {
  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry
        .addResourceHandler("/**")
        .addResourceLocations("classpath:/static/")
        .resourceChain(true)
        .addResolver(
            new PathResourceResolver() {
              @Override
              protected Resource getResource(String resourcePath, Resource location)
                  throws IOException {
                if (resourcePath.startsWith("api/")) {
                  return null;
                }
                Resource requested = location.createRelative(resourcePath);
                if (requested.exists() && requested.isReadable()) {
                  return requested;
                }
                String lastSegment =
                    resourcePath.contains("/")
                        ? resourcePath.substring(resourcePath.lastIndexOf('/') + 1)
                        : resourcePath;
                if (lastSegment.contains(".")) {
                  return null;
                }
                Resource index = new ClassPathResource("/static/index.html");
                return index.exists() ? index : null;
              }
            });
  }
}
