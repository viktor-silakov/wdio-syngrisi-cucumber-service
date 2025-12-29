Feature: Syngrisi WDIO service
  Scenario: Browser can report a screenshot to Syngrisi
    Given I visit the target page
    When I send the snapshot named "homepage"
    Then Syngrisi returns a response with an identifier
